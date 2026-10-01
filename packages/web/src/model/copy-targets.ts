import type { ProjectSuggestion } from "../api";

export interface CopyTarget {
  path: string;
  label: string;
}

const folderName = (path: string) => path.split("/").at(-1) ?? path;

/**
 * Every folder a skill can be copied into: discovered projects, their available worktrees, and
 * the open folder when it was added by hand. The server accepts exactly these.
 */
export function copyTargets(
  projects: readonly ProjectSuggestion[],
  openFolder?: string
): CopyTarget[] {
  const targets = projects.flatMap((project) => {
    const name = folderName(project.path);
    const worktrees = (project.worktrees ?? []).filter(
      (tree) =>
        !tree.isMain && tree.state === "available" && tree.path !== project.path
    );
    return [
      { path: project.path, label: name },
      ...worktrees.map((tree) => ({
        path: tree.path,
        label: `${name} · ${tree.branch ?? folderName(tree.path)}`
      }))
    ];
  });
  if (openFolder && !targets.some((target) => target.path === openFolder)) {
    targets.push({ path: openFolder, label: folderName(openFolder) });
  }
  return targets;
}
