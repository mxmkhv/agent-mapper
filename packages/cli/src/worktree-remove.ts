import { basename, isAbsolute, resolve } from "node:path";
import { git, repositoryWorktrees } from "./worktree-git";

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
 * uncommitted changes or untracked files, or is locked, and that refusal is passed on. Ignored files (.env,
 * node_modules, build output) are deleted with the folder. The branch is kept.
 * The path must match a linked, available worktree in a fresh `git worktree list`, so the browser cannot
 * name an arbitrary folder.
 */
export async function removeWorktree(value: string | undefined): Promise<void> {
  if (!value || !isAbsolute(value)) {
    throw new Error("Send the worktree's absolute folder path.");
  }
  const path = resolve(value);
  const worktrees = await repositoryWorktrees(path);
  const target = worktrees.find((tree) => tree.path === path);
  const main = worktrees.find((tree) => tree.isMain);
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
      `${basename(path)} is ${target.state}, so there is no folder to remove. Use Prune to clear a stale entry.`
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

/**
 * Clears Git's record of one linked worktree whose folder is already gone. Runs `git worktree remove` on that
 * entry, which for a missing folder only deletes `.git/worktrees/<name>`; `git worktree prune` would clear every
 * stale entry in the repository at once. The branch is kept.
 * The folder no longer exists, so the request names a checkout of the repository as well; the stale path must
 * be marked prunable in a fresh `git worktree list` there.
 */
export async function pruneWorktree(request: {
  repository?: string;
  path?: string;
}): Promise<void> {
  const { repository, path } = request;
  if (!repository || !path || !isAbsolute(repository) || !isAbsolute(path)) {
    throw new Error(
      "Send the repository's folder and the stale worktree's absolute path."
    );
  }
  const worktrees = await repositoryWorktrees(resolve(repository));
  const target = worktrees.find((tree) => tree.path === resolve(path));
  const main = worktrees.find((tree) => tree.isMain);
  if (!target || !main || target.isMain) {
    throw new Error(
      `${path} is not a linked worktree of this repository. Rescan to refresh the worktree list.`
    );
  }
  if (target.state !== "prunable") {
    throw new Error(
      `${basename(path)} is ${target.state}, not stale, so there is nothing to prune. Rescan to refresh the worktree list.`
    );
  }
  try {
    await git(main.path, ["worktree", "remove", target.path]);
  } catch (error) {
    throw new Error(
      `Git did not prune ${basename(path)}: ${gitMessage(error)}`,
      { cause: error }
    );
  }
}
