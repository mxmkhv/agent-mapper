import { expect, it } from "vitest";
import {
  blockingDiagnostics,
  validateDocument
} from "./source-document-validation";

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
