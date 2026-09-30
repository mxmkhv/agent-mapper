import { realpath } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";
import type { ToolId } from "@agent-mapper/core";
import { errnoCode, ioError } from "./source-document-errors";

export const inside = (path: string, root: string) =>
  path === root || path.startsWith(`${root}${sep}`);

export async function realOrSelf(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return path;
    }
    throw ioError(error, `Resolving ${path}`);
  }
}

/** The real path of `path`, resolving links in whichever part of it exists. */
export async function resolvedPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (errnoCode(error) !== "ENOENT") {
      throw ioError(error, `Resolving ${path}`);
    }
    const parent = dirname(path);
    return parent === path
      ? path
      : join(await resolvedPath(parent), basename(path));
  }
}

const toolNames: Record<ToolId, string> = {
  claude: "Claude Code",
  codex: "Codex"
};

/** Two tools' skills folders can be one folder through a link; copying twice would collide. */
export async function distinctFolders(
  destinations: { tool: ToolId; path: string }[]
): Promise<{ unique: { tool: ToolId; path: string }[]; notes: string[] }> {
  const seen = new Map<string, { tool: ToolId; path: string }>();
  const notes: string[] = [];
  for (const destination of destinations) {
    const real = await resolvedPath(destination.path);
    const first = seen.get(real);
    if (first) {
      notes.push(
        `${destination.path} is the same folder as ${first.path}, so one copy serves ${toolNames[destination.tool]} too.`
      );
    } else {
      seen.set(real, destination);
    }
  }
  return { unique: [...seen.values()], notes };
}
