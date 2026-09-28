import type { InventorySnapshot } from "@agent-mapper/core";

export interface PathContext {
  home?: string;
  projectRoot?: string;
}

/** The browser has no home directory; the Claude root sits directly under it by default. */
export function pathContext(
  snapshot: InventorySnapshot,
  isProject: boolean
): PathContext {
  const root = snapshot.roots.claude;
  const home = root.endsWith("/.claude")
    ? root.slice(0, -"/.claude".length)
    : undefined;
  return {
    home,
    projectRoot: isProject ? snapshot.workingDirectory : undefined
  };
}

export function tildePath(path: string, context: PathContext): string {
  if (
    context.home &&
    (path === context.home || path.startsWith(`${context.home}/`))
  ) {
    return `~${path.slice(context.home.length)}`;
  }
  return path;
}

/** Resolver reasons embed absolute paths mid-sentence; shorten every one of them. */
export function tildeText(text: string, context: PathContext): string {
  return context.home ? text.split(`${context.home}/`).join("~/") : text;
}

/** Project files read relative to the project root; everything else uses `~`. */
export function shortPath(path: string, context: PathContext): string {
  const root = context.projectRoot;
  if (root && path.startsWith(`${root}/`)) {
    return path.slice(root.length + 1);
  }
  return tildePath(path, context);
}

export function splitPath(path: string) {
  const cut = path.lastIndexOf("/");
  return { directory: path.slice(0, cut + 1), file: path.slice(cut + 1) };
}

export function isInside(path: string, root: string): boolean {
  return path.startsWith(`${root}/`);
}
