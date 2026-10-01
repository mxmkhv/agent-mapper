import { expect, it } from "vitest";
import {
  blockingDiagnostics,
  validateDocument
} from "./source-document-validation";
import { declaredMetadata } from "./declared-metadata";

const codes = (content: string, kind: "skill" | "instruction" = "skill") =>
  validateDocument(content, kind).map(
    (item) => `${item.severity}:${item.code}`
  );

it("accepts a complete skill", () => {
  expect(codes("---\nname: a\ndescription: b\n---\nBody\n")).toEqual([]);
});

it("blocks broken skill frontmatter and only warns for missing fields", () => {
  expect(codes("---\nname: a\n")).toEqual(["error:frontmatter-unterminated"]);
  expect(codes("---\nname: a\nname: b\ndescription: c\n---\n")).toEqual([
    "error:frontmatter-duplicate-key"
  ]);
  expect(codes("---\n- a\n- b\n---\n")).toEqual(["error:frontmatter-shape"]);
  expect(codes("---\nname: 123\ndescription: b\n---\n")).toEqual([
    "error:skill-name-type"
  ]);
  expect(codes("---\nname: a\n---\n")).toEqual([
    "warning:skill-description-missing"
  ]);
  expect(codes("# No frontmatter\n")).toEqual([
    "warning:skill-frontmatter-missing"
  ]);
});

it("reports aliases instead of expanding them", () => {
  expect(codes("---\nname: &x a\ndescription: *x\n---\n")).toEqual([
    "warning:skill-description-alias"
  ]);
});

it("keeps instruction findings as warnings so the file can still be saved", () => {
  const diagnostics = validateDocument(
    "---\nkey: [broken\n---\n",
    "instruction"
  );
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(blockingDiagnostics(diagnostics)).toBe(false);
  expect(validateDocument("# Plain\n", "instruction")).toEqual([]);
});

it("validates CRLF text the same as LF and points at the frontmatter line", () => {
  expect(codes("---\r\nname: [x\r\n---\r\n")).toEqual(
    codes("---\nname: [x\n---\n")
  );
  const [problem] = validateDocument(
    "---\nname: a\nname: b\ndescription: c\n---\n",
    "skill"
  );
  expect(problem?.line).toBe(3);
});

it("checks a Claude Code agent's frontmatter like a skill's", () => {
  const agent = (content: string) =>
    validateDocument(content, "agent").map(
      (item) => `${item.severity}:${item.code}`
    );
  expect(agent("---\nname: a\ndescription: b\n---\nBody\n")).toEqual([]);
  expect(agent("---\nname: a\n---\n")).toEqual([
    "warning:agent-description-missing"
  ]);
  expect(agent("---\nname: [x\n---\n")[0]).toMatch(/^error:frontmatter-/);
});

it("blocks a Codex agent whose TOML is broken or mistyped", () => {
  const toml = (content: string) => validateDocument(content, "agent-toml");
  const complete =
    'name = "a"\ndescription = "b"\ndeveloper_instructions = "c"\n';
  expect(toml(complete)).toEqual([]);
  expect(toml('name = "a"\ndescription = [1,\n')).toEqual([
    {
      severity: "error",
      code: "toml-syntax",
      message: "Invalid TOML document: invalid value.",
      line: 3,
      column: 1
    }
  ]);
  expect(
    toml('name = 1\ndescription = "b"\n').map(
      (item) => `${item.severity}:${item.code}`
    )
  ).toEqual([
    "error:agent-name-type",
    "warning:agent-developer_instructions-missing"
  ]);
});

it("reads skill metadata the same way across line endings and quoting", () => {
  const variants = [
    "---\nname: writer\ndescription: Drafts posts\n---\nBody\n",
    "---\r\nname: writer\r\ndescription: Drafts posts\r\n---\r\nBody\r\n",
    `---\nname: "writer"\ndescription: 'Drafts posts'\n---\nBody\n`
  ];
  for (const content of variants) {
    expect(declaredMetadata(content, "skill")).toMatchObject({
      name: "writer",
      problem: undefined
    });
  }
  const crlf = variants[1]!;
  expect(declaredMetadata(crlf, "skill").characters).toBe(
    crlf.indexOf("---\r\nBody") + "---".length
  );
});

it("reports the blocking problem of malformed skill frontmatter", () => {
  expect(
    declaredMetadata("---\nname: a\nname: b\n---\n", "skill")
  ).toMatchObject({
    name: "a",
    problem: "Frontmatter repeats a key. Keep one of them. (line 3)"
  });
  expect(declaredMetadata("---\nname: [a]\n---\n", "command")).toMatchObject({
    name: undefined,
    problem: undefined
  });
});
