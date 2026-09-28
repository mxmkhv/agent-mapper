import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";
import { configFiles } from "./worktree-files";
import { trackedFiles } from "./worktree-git";

const roots: string[] = [];
function fixture(): string {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-git-errors-"))
  );
  roots.push(home);
  return home;
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reports a broken Git checkout instead of treating it as a plain folder", async () => {
  const home = fixture();
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
  const home = fixture();
  const result = await configFiles(join(home, "removed"));
  expect(result.files.size).toBe(0);
  expect(result.errors).toContainEqual(
    expect.stringContaining("Could not resolve configuration directory")
  );
});

it("reports unreadable comparison files and Git tracking failures", async () => {
  const home = fixture();
  const config = join(home, ".claude");
  mkdirSync(config);
  symlinkSync(join(home, "missing.json"), join(config, "settings.local.json"));
  const files = await configFiles(home);
  expect(files.files.get(".claude/settings.local.json")?.readState).toBe(
    "unreadable"
  );
  expect(files.errors).toContainEqual(
    expect.stringContaining("Could not read configuration file")
  );
  const errors: string[] = [];
  expect(await trackedFiles(home, errors)).toBeUndefined();
  expect(errors).toContainEqual(
    expect.stringContaining("Could not list tracked files")
  );
});
