import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  truncateSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { scanInventory } from "./inventory";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-skill-meta-"));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project };
}

it("keeps a skill with an unquoted colon readable and named, showing the problem", async () => {
  const { home, project } = fixture();
  const folder = join(project, ".agents", "skills", "drafts");
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, "SKILL.md"),
    "---\ndescription: Use when: drafting posts\nname: writer\n---\nBody\n"
  );
  const result = await scanInventory({ workingDirectory: project, home });
  expect(result.entries.find((entry) => entry.kind === "skill")).toMatchObject({
    name: "writer",
    readState: "readable",
    frontmatterProblem: expect.stringContaining("(line 2)")
  });
  expect(
    result.entries.find((entry) => entry.kind === "skill")?.error
  ).toBeUndefined();
});

it("does not read a source over the size cap", async () => {
  const { home, project } = fixture();
  const path = join(project, "CLAUDE.md");
  writeFileSync(path, "");
  truncateSync(path, 10 * 1024 * 1024 + 1);
  const result = await scanInventory({ workingDirectory: project, home });
  expect(result.entries).toContainEqual(
    expect.objectContaining({
      path,
      readState: "unreadable",
      error: expect.stringContaining("larger than 10 MiB")
    })
  );
});
