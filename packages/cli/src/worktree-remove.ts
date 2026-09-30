import { basename, isAbsolute, resolve } from "node:path";
import { git, readWorktrees } from "./worktree-git";

function gitMessage(error: unknown): string {
  const stderr = (error as { stderr?: unknown } | undefined)?.stderr;
  const text = typeof stderr === "string" ? stderr.trim() : "";
  return text.replace(/^(fatal|error): /i, "") || String(error);
}

/** Git's own wording suggests --force, which this action deliberately never uses; name the fix instead. */
function refusal(name: string, reason: string): string {
  if (/modified or untracked/i.test(reason)) {
    return `Git did not remove ${name}: it has uncommitted or untracked files. Commit, stash, or discard them, then try again.`;
  }
  if (/locked/i.test(reason)) {
    return `Git did not remove ${name}: it is locked. Run git worktree unlock on it, then try again.`;
  }
  return `Git did not remove ${name}: ${reason}`;
}

/**
 * Runs `git worktree remove` for one linked worktree, without --force: Git refuses when the checkout has
 * uncommitted or untracked files, or is locked, and that refusal is passed on. The branch is kept.
 * The path must match a linked, available worktree in a fresh `git worktree list`, so the browser cannot
 * name an arbitrary folder.
 */
export async function removeWorktree(value: string | undefined): Promise<void> {
  if (!value || !isAbsolute(value)) {
    throw new Error("Send the worktree's absolute folder path.");
  }
  const path = resolve(value);
  const scan = await readWorktrees(path);
  const target = scan.worktrees.find((tree) => tree.path === path);
  const main = scan.worktrees.find((tree) => tree.isMain);
  if (!target || !main) {
    throw new Error(
      `${path} is not a Git worktree. Rescan to refresh the worktree list.`
    );
  }
  if (target.isMain) {
    throw new Error(
      "The main checkout cannot be removed here. Remove linked worktrees only."
    );
  }
  if (target.state !== "available") {
    throw new Error(
      `${basename(path)} is ${target.state}. Run git worktree prune in ${main.path} to clear stale entries.`
    );
  }
  try {
    // Run from the main checkout: Git cannot remove the worktree it is running in.
    await git(main.path, ["worktree", "remove", path]);
  } catch (error) {
    throw new Error(refusal(basename(path), gitMessage(error)), {
      cause: error
    });
  }
}
