import { findGitRoot } from "./discovery";
import { readWorktrees, type WorktreeScan } from "./worktree-git";

export interface ScanContext {
  root: string;
  worktrees: WorktreeScan;
}

export async function resolveScanContext(
  workingDirectory: string
): Promise<ScanContext> {
  const worktrees = await readWorktrees(workingDirectory);
  const root =
    worktrees.selectedRoot ??
    (await findGitRoot(workingDirectory, {
      stop: "/",
      errors: worktrees.errors
    })) ??
    workingDirectory;
  return { root, worktrees };
}
