import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { pruneWorktree, removeWorktree } from "./worktree-remove";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function git(directory: string, ...args: string[]): string {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" });
}

function repository() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-remove-"))
  );
  roots.push(home);
  const main = join(home, "app");
  const linked = join(home, "app-feature");
  mkdirSync(main);
  git(main, "init", "-b", "main");
  writeFileSync(join(main, "AGENTS.md"), "Instructions");
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
  git(main, "worktree", "add", "-b", "feature", linked);
  return { main, linked };
}

it("removes a clean linked worktree and keeps its branch", async () => {
  const { main, linked } = repository();
  await removeWorktree(linked);
  expect(existsSync(linked)).toBe(false);
  expect(git(main, "worktree", "list")).not.toContain(linked);
  expect(git(main, "branch", "--list", "feature")).toContain("feature");
});

it("passes on Git's refusal to remove a worktree with changes", async () => {
  const { linked } = repository();
  writeFileSync(join(linked, "notes.md"), "Uncommitted");
  await expect(removeWorktree(linked)).rejects.toThrow(
    "Git did not remove app-feature: it has uncommitted or untracked files. Commit, stash, or discard them, then try again."
  );
  expect(existsSync(join(linked, "notes.md"))).toBe(true);
});

it("explains a locked worktree without suggesting --force", async () => {
  const { main, linked } = repository();
  git(main, "worktree", "lock", linked);
  await expect(removeWorktree(linked)).rejects.toThrow(
    "Git did not remove app-feature: it is locked. Run git worktree unlock on it, then try again."
  );
  expect(existsSync(linked)).toBe(true);
});

it("refuses the main checkout, unknown folders, and relative paths", async () => {
  const { main } = repository();
  await expect(removeWorktree(main)).rejects.toThrow(
    "The main checkout cannot be removed here. Remove linked worktrees only."
  );
  const plain = join(main, "..", "plain");
  mkdirSync(plain);
  await expect(removeWorktree(plain)).rejects.toThrow(
    `${plain} is not a Git worktree. Rescan to refresh the worktree list.`
  );
  await expect(removeWorktree("app-feature")).rejects.toThrow(
    "Send the worktree's absolute folder path."
  );
});

it("prunes one stale entry, keeping its branch and other stale entries", async () => {
  const { main, linked } = repository();
  const other = join(main, "..", "app-other");
  git(main, "worktree", "add", "-b", "other", other);
  rmSync(linked, { recursive: true });
  rmSync(other, { recursive: true });
  await pruneWorktree({ repository: main, path: linked });
  const list = git(main, "worktree", "list");
  expect(list).not.toContain(linked);
  expect(list).toContain(other);
  expect(git(main, "branch", "--list", "feature")).toContain("feature");
});

it("refuses to prune a worktree whose folder still exists", async () => {
  const { main, linked } = repository();
  await expect(
    pruneWorktree({ repository: main, path: linked })
  ).rejects.toThrow(
    "app-feature is available, not stale, so there is nothing to prune. Rescan to refresh the worktree list."
  );
  expect(existsSync(linked)).toBe(true);
  await expect(pruneWorktree({ repository: main, path: main })).rejects.toThrow(
    "is not a linked worktree of this repository"
  );
  await expect(pruneWorktree({ path: linked })).rejects.toThrow(
    "Send the repository's folder and the stale worktree's absolute path."
  );
});
