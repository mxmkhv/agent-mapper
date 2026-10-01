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

it("matches a lock entry by the folder the skill really lives in", async () => {
  const home = fixture();
  const project = join(home, "app");
  mkdirSync(join(project, ".agents", "skills", "argent-lens"), {
    recursive: true
  });
  writeFileSync(
    join(project, ".agents", "skills", "argent-lens", "SKILL.md"),
    "---\nname: lens\n---\nBody"
  );
  mkdirSync(join(project, ".claude", "skills"), { recursive: true });
  symlinkSync(
    join(project, ".agents", "skills", "argent-lens"),
    join(project, ".claude", "skills", "alias")
  );
  writeFileSync(
    join(project, "skills-lock.json"),
    JSON.stringify({
      skills: { "argent-lens": { source: "software-mansion/argent" } }
    })
  );

  const result = await scanInventory({ workingDirectory: project, home });
  // Claude sees it through the renamed link, Codex in `.agents/skills` itself.
  expect(
    result.entries.map((entry) => [
      entry.tool,
      entry.name,
      entry.installedFrom?.repo
    ])
  ).toEqual([
    ["claude", "lens", "software-mansion/argent"],
    ["codex", "lens", "software-mansion/argent"]
  ]);
});

it("keeps project and global lock files apart", async () => {
  const home = fixture();
  const project = join(home, "app");
  writeSkill(join(project, ".claude", "skills"), "only-global");
  writeSkill(join(home, ".claude", "skills"), "only-project");
  writeFileSync(
    join(project, "skills-lock.json"),
    JSON.stringify({ skills: { "only-project": { source: "a/project" } } })
  );
  mkdirSync(join(home, ".agents"), { recursive: true });
  writeFileSync(
    join(home, ".agents", ".skill-lock.json"),
    JSON.stringify({ skills: { "only-global": { source: "a/global" } } })
  );

  const result = await scanInventory({ workingDirectory: project, home });
  expect(
    result.entries.map((entry) => [entry.name, entry.installedFrom])
  ).toEqual([
    ["only-project", undefined],
    ["only-global", undefined]
  ]);
});

it("reports an unreadable lock file once, however many skills use it", async () => {
  const home = fixture();
  const project = join(home, "app");
  writeSkill(join(project, ".claude", "skills"), "one");
  writeSkill(join(project, ".claude", "skills"), "two");
  mkdirSync(join(project, "skills-lock.json"));

  const result = await scanInventory({ workingDirectory: project, home });
  expect(result.entries.map((entry) => entry.name).sort()).toEqual([
    "one",
    "two"
  ]);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain("Could not read the skills lock file");
  expect(result.errors[0]).toContain("EISDIR");
});

it("reports lock files and entries with an unexpected shape", async () => {
  const home = fixture();
  const project = join(home, "app");
  const lockPath = join(project, "skills-lock.json");
  writeSkill(join(project, ".claude", "skills"), "good");
  writeSkill(join(project, ".claude", "skills"), "bad");

  writeFileSync(lockPath, JSON.stringify({ skills: ["good"] }));
  const wrongShape = await scanInventory({ workingDirectory: project, home });
  expect(wrongShape.entries.map((entry) => entry.installedFrom)).toEqual([
    undefined,
    undefined
  ]);
  expect(wrongShape.errors).toEqual([
    `${lockPath}: The skills lock file has an unexpected structure (no "skills" object), so installed skills show no source repo. Reinstall the skills or update agent-mapper.`
  ]);

  writeFileSync(
    lockPath,
    JSON.stringify({
      skills: { good: { source: "a/repo", ref: 3 }, bad: { source: 7 } }
    })
  );
  const wrongEntry = await scanInventory({ workingDirectory: project, home });
  expect(
    Object.fromEntries(
      wrongEntry.entries.map((entry) => [entry.name, entry.installedFrom])
    )
  ).toEqual({ good: { repo: "a/repo", ref: undefined }, bad: undefined });
  expect(wrongEntry.errors).toEqual([
    `${lockPath}: No readable "source" for bad, so those skills show no source repo. Reinstall them or update agent-mapper.`
  ]);
});
