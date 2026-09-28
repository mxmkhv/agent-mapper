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
import { discoverProjects, scanInventory } from "./inventory";

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "agent-mapper-inventory-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("finds project hits without walking generated or hidden home folders", async () => {
  const home = fixture();
  mkdirSync(join(home, "app"));
  writeFileSync(join(home, "app", "AGENTS.md"), "Project instructions");
  mkdirSync(join(home, "node_modules", "hidden"), { recursive: true });
  writeFileSync(join(home, "node_modules", "hidden", "AGENTS.md"), "skip");
  mkdirSync(join(home, ".private"));
  writeFileSync(join(home, ".private", "AGENTS.md"), "skip");

  const result = await discoverProjects(home);
  expect(result.projects.map((project) => project.path)).toEqual([
    join(home, "app")
  ]);
  expect(result.exclusions).toContain("node_modules");
});
it("reads ancestor instructions and project skills for both tools", async () => {
  const home = fixture();
  const project = join(home, "app");
  mkdirSync(join(project, "src"), { recursive: true });
  mkdirSync(join(project, ".git"));
  mkdirSync(join(project, ".agents", "skills", "review"), {
    recursive: true
  });
  mkdirSync(join(project, ".claude", "skills", "format"), {
    recursive: true
  });
  writeFileSync(join(project, "AGENTS.md"), "Codex project");
  writeFileSync(join(project, "CLAUDE.md"), "Claude project");
  writeFileSync(
    join(project, ".agents", "skills", "review", "SKILL.md"),
    "---\nname: review\ndescription: Check changes\n---\nBody"
  );
  writeFileSync(
    join(project, ".claude", "skills", "format", "SKILL.md"),
    "---\nname: format\n---\nBody"
  );

  const result = await scanInventory({
    workingDirectory: join(project, "src"),
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    result.entries
      .map((item) => `${item.tool}:${item.kind}:${item.name}`)
      .sort()
  ).toEqual([
    "claude:instruction:AGENTS.md",
    "claude:instruction:CLAUDE.md",
    "claude:skill:format",
    "codex:instruction:AGENTS.md",
    "codex:skill:review"
  ]);
  expect(
    result.entries.find((item) => item.name === "review")?.description
  ).toBeUndefined();
  const review = result.entries.find((item) => item.name === "review");
  expect(review?.metadataCharacters).toBeGreaterThan(0);
  expect(review?.characters).toBeGreaterThan(review?.metadataCharacters ?? 0);
});

it("finds global and nested Claude commands with their invocation names", async () => {
  const home = fixture();
  const project = join(home, "app");
  mkdirSync(join(home, ".claude", "commands"), { recursive: true });
  mkdirSync(join(project, ".claude", "commands", "frontend"), {
    recursive: true
  });
  writeFileSync(
    join(home, ".claude", "commands", "review.md"),
    "Global command"
  );
  writeFileSync(
    join(project, ".claude", "commands", "frontend", "component.md"),
    "Project command"
  );
  const result = await scanInventory({ workingDirectory: project, home });
  expect(
    result.entries
      .filter((entry) => entry.kind === "command")
      .map(({ name, scope }) => [name, scope])
  ).toEqual([
    ["review", "global"],
    ["frontend:component", "project"]
  ]);
});

it("shows a broken symlink instead of dropping it", async () => {
  const home = fixture();
  const project = join(home, "app");
  mkdirSync(project);
  symlinkSync(join(project, "missing.md"), join(project, "AGENTS.md"));

  const result = await scanInventory({
    workingDirectory: project,
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    result.entries.filter((entry) => entry.tool === "codex")
  ).toMatchObject([
    {
      tool: "codex",
      readState: "missing",
      isSymlink: true,
      path: join(project, "AGENTS.md")
    }
  ]);
});

it("stops project instruction discovery at the Git root", async () => {
  const home = fixture();
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(join(project, "src"));
  writeFileSync(join(home, "AGENTS.md"), "Home project instructions");
  writeFileSync(join(home, "CLAUDE.md"), "Home Claude instructions");
  writeFileSync(join(project, "AGENTS.md"), "Repository instructions");

  const result = await scanInventory({
    workingDirectory: join(project, "src"),
    home
  });
  expect(
    result.entries
      .filter((entry) => entry.kind === "instruction" && entry.tool === "codex")
      .map((entry) => entry.path)
  ).toEqual([join(project, "AGENTS.md")]);
  expect(
    result.entries
      .filter(
        (entry) =>
          entry.kind === "instruction" &&
          entry.tool === "claude" &&
          entry.name === "CLAUDE.md"
      )
      .map((entry) => entry.path)
  ).toEqual([join(home, "CLAUDE.md")]);
});

it("limits Codex project sources to the selected non-Git folder", async () => {
  const home = fixture();
  const project = join(home, "app");
  const nested = join(project, "src");
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(project, "AGENTS.md"), "Parent instructions");
  writeFileSync(join(nested, "AGENTS.md"), "Selected instructions");

  const result = await scanInventory({ workingDirectory: nested, home });
  expect(
    result.entries
      .filter((entry) => entry.kind === "instruction" && entry.tool === "codex")
      .map((entry) => entry.path)
  ).toEqual([join(nested, "AGENTS.md")]);
  expect(
    result.entries
      .filter(
        (entry) => entry.kind === "instruction" && entry.tool === "claude"
      )
      .map((entry) => entry.path)
  ).toEqual([join(project, "AGENTS.md"), join(nested, "AGENTS.md")]);
});
