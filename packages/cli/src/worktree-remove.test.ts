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
import { removeWorktree } from "./worktree-remove";

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
