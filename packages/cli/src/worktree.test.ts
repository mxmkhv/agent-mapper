import { execFileSync } from "node:child_process";
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
import type { InventorySnapshot } from "@agent-mapper/core";
import { buildSnapshot } from "./service";
import { discoverProjects } from "./discovery";
import { sourcePath } from "./source-actions";
import { configFiles } from "./worktree-files";

const roots: string[] = [];

function git(directory: string, ...args: string[]): void {
  execFileSync("git", ["-C", directory, ...args], { stdio: "ignore" });
}

function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-worktree-"))
  );
  roots.push(home);
  const main = join(home, "app");
  const linked = join(home, "feature checkout");
  mkdirSync(main);
  git(main, "init", "-b", "main");
  mkdirSync(join(main, ".claude", "agents"), { recursive: true });
  writeFileSync(join(main, "AGENTS.md"), "Main instructions");
  writeFileSync(
    join(main, ".claude", "agents", "reviewer.md"),
    "---\nname: reviewer\ndescription: Review code\n---\nMain prompt"
  );
  git(main, "add", ".");
  git(
    main,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "Initial"
  );
  git(main, "worktree", "add", "--detach", linked);
  writeFileSync(join(main, ".claude", "settings.local.json"), '{"hooks":{}}');
  writeFileSync(join(linked, "AGENTS.md"), "Linked instructions");
  rmSync(join(linked, ".claude", "agents", "reviewer.md"));
  mkdirSync(join(linked, ".codex", "agents"), { recursive: true });
  writeFileSync(
    join(linked, ".codex", "agents", "researcher.toml"),
    'name = "researcher"\ndescription = "Research"\ndeveloper_instructions = "Find sources"'
  );
  return { home, main, linked };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function expectMetadata(
  snapshot: InventorySnapshot,
  paths: { main: string; linked: string }
): void {
  expect(
    snapshot.comparison?.differences.map((row) => [row.relativePath, row.tool])
  ).toEqual([
    [".claude/agents/reviewer.md", "claude"],
    [".claude/settings.local.json", "claude"],
    [".codex/agents/researcher.toml", "codex"],
    ["AGENTS.md", "shared"]
  ]);
  expect(
    snapshot.comparison?.differences.find(
      (row) => row.relativePath === "AGENTS.md"
    )?.main?.tracking
  ).toBe("tracked");
  expect(
    snapshot.comparison?.differences.find(
      (row) => row.relativePath === ".claude/settings.local.json"
    )?.main?.tracking
  ).toBe("not tracked");
  const changed = snapshot.comparison?.differences.find(
    (row) => row.relativePath === "AGENTS.md"
  );
  expect(sourcePath(snapshot, changed?.main?.id ?? "")).toBe(
    join(paths.main, "AGENTS.md")
  );
  expect(sourcePath(snapshot, changed?.here?.id ?? "")).toBe(
    join(paths.linked, "AGENTS.md")
  );
}

it("compares a linked worktree with its main checkout without exposing content", async () => {
  const { home, main, linked } = fixture();
  const snapshot = await buildSnapshot(linked, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    snapshot.worktrees.map(({ path, isMain, state }) => [path, isMain, state])
  ).toEqual([
    [main, true, "available"],
    [linked, false, "available"]
  ]);
  expect(snapshot.comparison).toMatchObject({
    mainPath: main,
    herePath: linked
  });
  expect(
    snapshot.comparison?.differences.map(({ relativePath, state }) => [
      relativePath,
      state
    ])
  ).toEqual([
    [".claude/agents/reviewer.md", "only-main"],
    [".claude/settings.local.json", "only-main"],
    [".codex/agents/researcher.toml", "only-here"],
    ["AGENTS.md", "different-content"]
  ]);
  expectMetadata(snapshot, { main, linked });
  expect(JSON.stringify(snapshot)).not.toContain("Linked instructions");
  expect(JSON.stringify(snapshot)).not.toContain("Main prompt");
});

it("groups discovered linked checkouts under the main project", async () => {
  const { home, main, linked } = fixture();
  const result = await discoverProjects(home);
  expect(result.projects.map((project) => project.path)).toEqual([main]);
  expect(
    result.projects[0]?.worktrees?.map((worktree) => worktree.path)
  ).toEqual([main, linked]);
});

it("compares configuration behind a linked directory while retaining the symlink entry", async () => {
  const { home, main, linked } = fixture();
  const first = join(home, "first shared", "skills", "review");
  const second = join(home, "second shared", "skills", "review");
  mkdirSync(first, { recursive: true });
  mkdirSync(second, { recursive: true });
  writeFileSync(join(first, "SKILL.md"), "First shared skill");
  writeFileSync(join(second, "SKILL.md"), "Second shared skill");
  symlinkSync(join(home, "first shared"), join(main, ".agents"), "dir");
  symlinkSync(join(home, "second shared"), join(linked, ".agents"), "dir");
  const snapshot = await buildSnapshot(linked, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    snapshot.comparison?.differences.map((item) => item.relativePath)
  ).toContain(".agents");
  expect(
    snapshot.comparison?.differences.map((item) => item.relativePath)
  ).toContain(".agents/skills/review/SKILL.md");
  expect(JSON.stringify(snapshot)).not.toContain("Second shared skill");
});

it("does not follow unrelated directory links outside the checkout", async () => {
  const { home, main, linked } = fixture();
  const outside = join(home, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "AGENTS.md"), "External instructions");
  symlinkSync(outside, join(main, "vendor"), "dir");
  const snapshot = await buildSnapshot(linked, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    snapshot.comparison?.differences.some((item) =>
      item.relativePath.startsWith("vendor/")
    )
  ).toBe(false);
});

it("shows registered stale worktrees without scanning missing folders", async () => {
  const { home, main, linked } = fixture();
  rmSync(linked, { recursive: true, force: true });
  const snapshot = await buildSnapshot(main, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.worktrees).toContainEqual(
    expect.objectContaining({ path: linked, isMain: false, state: "prunable" })
  );
  expect(snapshot.comparison).toBeUndefined();
});

it("keeps a linked checkout scannable when its main checkout is gone", async () => {
  const { home, main: source } = fixture();
  const bare = join(home, "repo.git");
  const main = join(home, "bare-main");
  const linked = join(home, "bare-linked");
  execFileSync("git", ["clone", "--bare", source, bare], { stdio: "ignore" });
  git(bare, "worktree", "add", main, "main");
  git(bare, "worktree", "add", "--detach", linked);
  rmSync(main, { recursive: true, force: true });
  const snapshot = await buildSnapshot(linked, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.worktrees).toContainEqual(
    expect.objectContaining({ path: main, isMain: true, state: "prunable" })
  );
  expect(snapshot.comparison).toBeUndefined();
  expect(snapshot.coverage).toContainEqual(
    expect.stringContaining("main checkout is unavailable")
  );
});

it("uses the first checkout instead of a bare repository as the baseline", async () => {
  const { home, main } = fixture();
  const bare = join(home, "repo.git");
  const bareMain = join(home, "bare-main");
  const bareFeature = join(home, "bare-feature");
  execFileSync("git", ["clone", "--bare", main, bare], { stdio: "ignore" });
  git(bare, "worktree", "add", bareMain, "main");
  git(bare, "worktree", "add", "--detach", bareFeature);
  writeFileSync(join(bareFeature, "AGENTS.md"), "Feature instructions");
  const snapshot = await buildSnapshot(bareFeature, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.worktrees.find((item) => item.isMain)?.path).toBe(bareMain);
  expect(snapshot.comparison?.mainPath).toBe(bareMain);
  expect(
    snapshot.comparison?.differences.find(
      (item) => item.relativePath === "AGENTS.md"
    )?.state
  ).toBe("different-content");
});

it("reports a broken Git checkout instead of treating it as a plain folder", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-broken-git-"))
  );
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  const snapshot = await buildSnapshot(project, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.coverage).toContainEqual(
    expect.stringContaining("Could not inspect Git worktrees")
  );
});

it("reports a removed configuration directory without throwing", async () => {
  const { home } = fixture();
  const missing = join(home, "removed");
  const result = await configFiles(missing);
  expect(result.files.size).toBe(0);
  expect(result.errors).toContainEqual(
    expect.stringContaining("Could not resolve configuration directory")
  );
});
