import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reports repeated startup text, long instructions, and broken links without exposing text", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-findings-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const nested = join(project, "src");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(nested);
  const paragraph =
    "Keep this project-only validation phrase private while checking the same substantive instruction across ancestor files.";
  writeFileSync(join(project, "CLAUDE.md"), `# Main\n\n${paragraph}\n`);
  writeFileSync(
    join(nested, "CLAUDE.md"),
    `# Nested\n\n${paragraph.replaceAll(" ", "  ")}\n`
  );
  writeFileSync(
    join(project, "AGENTS.md"),
    `${"Review each change carefully.\n".repeat(201)}`
  );
  symlinkSync(join(nested, "missing.md"), join(nested, "CLAUDE.local.md"));
  const snapshot = await buildSnapshot(nested, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.findings.map((finding) => finding.code)).toContain(
    "repeated-instruction"
  );
  expect(snapshot.findings.map((finding) => finding.code)).toContain(
    "long-instruction"
  );
  expect(snapshot.findings.map((finding) => finding.code)).toContain(
    "broken-symlink"
  );
  const repeated = snapshot.findings.find(
    (finding) => finding.code === "repeated-instruction"
  );
  expect(repeated?.sources.map((source) => source.path)).toEqual([
    join(project, "CLAUDE.md"),
    join(nested, "CLAUDE.md")
  ]);
  expect(JSON.stringify(snapshot)).not.toContain(paragraph);
});

it("does not flag a shared heading or short fragment as repeated content", async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-short-")));
  roots.push(home);
  const project = join(home, "app");
  const nested = join(project, "src");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(nested);
  writeFileSync(join(project, "CLAUDE.md"), "# Rules\n\nBe careful.\n");
  writeFileSync(join(nested, "CLAUDE.md"), "# Rules\n\nBe careful.\n");
  const snapshot = await buildSnapshot(nested, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    snapshot.findings.some((finding) => finding.code === "repeated-instruction")
  ).toBe(false);
});

it("flags separate skill files that share a name, but not links to one file", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-findings-"))
  );
  roots.push(home);
  const skill = (folder: string) => {
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, "SKILL.md"),
      "---\nname: react-render-skill\ndescription: Renders\n---\n"
    );
  };
  skill(join(home, ".agents/skills/react-render-skill"));
  skill(join(home, ".codex/skills/react-rendering"));
  skill(join(home, "shared/solo"));
  mkdirSync(join(home, ".claude/skills"), { recursive: true });
  symlinkSync(join(home, "shared/solo"), join(home, ".claude/skills/solo"));
  const snapshot = await buildSnapshot(home, {
    home,
    codexHome: join(home, ".codex")
  });
  const duplicates = snapshot.findings.filter(
    (finding) => finding.code === "duplicate-skill-name"
  );
  expect(duplicates.map((finding) => finding.tool)).toEqual(["codex"]);
  expect(duplicates[0]?.sources.map((source) => source.path)).toEqual([
    join(home, ".agents/skills/react-render-skill/SKILL.md"),
    join(home, ".codex/skills/react-rendering/SKILL.md")
  ]);
});
