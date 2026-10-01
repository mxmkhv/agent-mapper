import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { scanInventory } from "./inventory";

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "agent-mapper-skill-lock-"));
  roots.push(root);
  return root;
}

function writeSkill(directory: string, name: string): void {
  mkdirSync(join(directory, name), { recursive: true });
  writeFileSync(join(directory, name, "SKILL.md"), `# ${name}`);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("attaches the source repo from project and global lock files", async () => {
  const home = fixture();
  const project = join(home, "app");
  writeSkill(join(project, ".agents", "skills"), "argent-lens");
  writeSkill(join(project, ".claude", "skills"), "hand-written");
  mkdirSync(join(project, ".claude", "skills"), { recursive: true });
  symlinkSync(
    join(project, ".agents", "skills", "argent-lens"),
    join(project, ".claude", "skills", "argent-lens")
  );
  writeFileSync(
    join(project, "skills-lock.json"),
    JSON.stringify({
      version: 1,
      skills: {
        "argent-lens": { source: "software-mansion/argent", ref: "v0.22.1" }
      }
    })
  );
  writeSkill(join(home, ".claude", "skills"), "find-skills");
  mkdirSync(join(home, ".agents"), { recursive: true });
  writeFileSync(
    join(home, ".agents", ".skill-lock.json"),
    JSON.stringify({
      version: 3,
      skills: { "find-skills": { source: "vercel-labs/skills" } }
    })
  );

  const result = await scanInventory({
    workingDirectory: project,
    home,
    codexHome: join(home, ".codex")
  });
  const sources = Object.fromEntries(
    result.entries
      .filter((entry) => entry.kind === "skill")
      .map((entry) => [`${entry.tool}:${entry.name}`, entry.installedFrom])
  );
  expect(sources).toEqual({
    "claude:argent-lens": { repo: "software-mansion/argent", ref: "v0.22.1" },
    "codex:argent-lens": { repo: "software-mansion/argent", ref: "v0.22.1" },
    "claude:hand-written": undefined,
    "claude:find-skills": { repo: "vercel-labs/skills", ref: undefined }
  });
  expect(result.errors).toEqual([]);
});

it("reports a malformed lock file and keeps the skills", async () => {
  const home = fixture();
  const project = join(home, "app");
  writeSkill(join(project, ".claude", "skills"), "review");
  writeFileSync(join(project, "skills-lock.json"), "{ not json");

  const result = await scanInventory({ workingDirectory: project, home });
  expect(result.entries.map((entry) => entry.name)).toEqual(["review"]);
  expect(result.errors).toEqual([
    `${join(project, "skills-lock.json")}: The skills lock file is not valid JSON, so installed skills show no source repo. Reinstall the skills or fix the file.`
  ]);
});
