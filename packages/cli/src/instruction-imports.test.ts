import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];

function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-imports-"))
  );
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("tracks nested imports, skips code, and reports only explicit missing targets", async () => {
  const { home, project } = fixture();
  mkdirSync(join(project, "docs"));
  writeFileSync(
    join(project, "CLAUDE.md"),
    [
      "Read @docs/guide.md and @missing.md.",
      "`@inline.md`",
      "```md",
      "@fenced.md",
      "```"
    ].join("\n")
  );
  writeFileSync(
    join(project, "docs", "guide.md"),
    "Read @../more.md. Private guide text."
  );
  writeFileSync(join(project, "more.md"), "Private imported text.");

  const snapshot = await buildSnapshot(project, { home });
  expect(
    snapshot.imports.map(({ targetPath, state, depth }) => [
      targetPath,
      state,
      depth
    ])
  ).toEqual([
    [join(project, "docs", "guide.md"), "readable", 1],
    [join(project, "more.md"), "readable", 2],
    [join(project, "missing.md"), "missing", 1]
  ]);
  expect(
    snapshot.findings.filter(({ code }) => code === "missing-import")
  ).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain("Private imported text");
  expect(JSON.stringify(snapshot)).not.toContain("Private guide text");
});

it("does not scan a Claude file shadowed by the selected fallback rule", async () => {
  const { home, project } = fixture();
  writeFileSync(join(project, "CLAUDE.md"), "Claude guidance");
  writeFileSync(join(project, "AGENTS.md"), "@missing.md");

  const snapshot = await buildSnapshot(project, { home });
  expect(snapshot.imports).toEqual([]);
  expect(snapshot.findings.some(({ code }) => code === "missing-import")).toBe(
    false
  );
});

it("keeps external project imports approval unknown", async () => {
  const { home, project } = fixture();
  writeFileSync(join(project, "CLAUDE.md"), "@../shared.md");
  writeFileSync(join(home, "shared.md"), "Private shared text. @missing.md");

  const snapshot = await buildSnapshot(project, { home });
  expect(snapshot.imports).toMatchObject([
    {
      targetPath: join(home, "shared.md"),
      state: "approval-unknown"
    }
  ]);
  expect(snapshot.findings.some(({ code }) => code === "missing-import")).toBe(
    false
  );
  expect(JSON.stringify(snapshot)).not.toContain("Private shared text");
});

it("stops at four import hops and keeps missing findings distinct", async () => {
  const { home, project } = fixture();
  writeFileSync(
    join(project, "CLAUDE.md"),
    "@one.md @absent-a.md @absent-b.md"
  );
  writeFileSync(join(project, "one.md"), "@two.md");
  writeFileSync(join(project, "two.md"), "@three.md");
  writeFileSync(join(project, "three.md"), "@four.md");
  writeFileSync(join(project, "four.md"), "@five.md");

  const snapshot = await buildSnapshot(project, { home });
  expect(snapshot.imports.map(({ depth }) => depth)).toEqual([
    1, 2, 3, 4, 1, 1
  ]);
  expect(
    snapshot.imports.some(({ targetPath }) => targetPath.endsWith("five.md"))
  ).toBe(false);
  const missing = snapshot.findings.filter(
    ({ code }) => code === "missing-import"
  );
  expect(missing).toHaveLength(2);
  expect(new Set(missing.map(({ id }) => id)).size).toBe(2);
});
