import { lstat, realpath } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { extname } from "node:path";
import type { InventorySnapshot } from "@agent-mapper/core";
import type { Desktop, DesktopRequest } from "./desktop";

interface ActionContext {
  request: IncomingMessage;
  paths: SourcePathStore;
  desktop: Desktop;
}
export type SourcePathStore = Map<
  string,
  { global?: Map<string, string>; project?: Map<string, string> }
>;
const requestLimit = 16_384;
const safeTextExtensions = new Set([
  ".md",
  ".txt",
  ".json",
  ".jsonc",
  ".toml",
  ".yaml",
  ".yml"
]);

export async function readJson(
  request: IncomingMessage
): Promise<Record<string, string>> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > requestLimit) {
      throw new Error("Request is too large. Submit a shorter path.");
    }
  }
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Request must be a JSON object.");
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}

export function sourcePathIndex(
  snapshot: InventorySnapshot
): Map<string, string> {
  const result = new Map<string, string>();
  const add = (id: string, path: string) => {
    if (!result.has(id)) {
      result.set(id, path);
    }
  };
  for (const item of snapshot.items) {
    add(item.entry.id, item.entry.path);
  }
  for (const item of snapshot.plugins) {
    add(item.id, item.sourcePath);
  }
  for (const item of snapshot.hooks) {
    add(item.id, item.sourcePath);
  }
  for (const item of snapshot.mcpServers) {
    add(item.id, item.sourcePath);
  }
  for (const item of snapshot.memories) {
    add(item.id, item.sourcePath);
  }
  for (const item of snapshot.agents) {
    add(item.id, item.sourcePath);
  }
  for (const row of snapshot.comparison?.differences ?? []) {
    if (row.main) {
      add(row.main.id, row.main.path);
    }
    if (row.here) {
      add(row.here.id, row.here.path);
    }
  }
  return result;
}

type SourceAction = "open" | "reveal" | "reveal-target";
const sourceActions: readonly string[] = ["open", "reveal", "reveal-target"];

function isSourceAction(value: string): value is SourceAction {
  return sourceActions.includes(value);
}

/** The file a symlinked source resolves to, which is what the file manager should select for "reveal-target". */
async function linkTarget(source: string): Promise<string> {
  try {
    return await realpath(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${source} points to a file that no longer exists. Fix the symlink, then rescan.`,
        { cause: error }
      );
    }
    throw error;
  }
}

/**
 * Only regular files with a text extension are opened, on every platform.
 * Symlinks, folders, apps and scripts are revealed so nothing executable is launched.
 */
export async function desktopRequest(
  action: SourceAction,
  source: string
): Promise<DesktopRequest> {
  if (action === "reveal-target") {
    return { action: "reveal", path: await linkTarget(source) };
  }
  const reveal: DesktopRequest = { action: "reveal", path: source };
  if (action === "reveal" || !safeTextExtensions.has(extname(source))) {
    return reveal;
  }
  try {
    return (await lstat(source)).isFile()
      ? { action: "open", path: source }
      : reveal;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${source} no longer exists. Rescan and try again.`);
    }
    throw error;
  }
}

export async function performSourceAction(
  context: ActionContext
): Promise<void> {
  const body = await readJson(context.request);
  if (!body.path || !body.id || !body.action) {
    throw new Error("Choose a source and action.");
  }
  if (!isSourceAction(body.action)) {
    throw new Error("Choose Open or Reveal.");
  }
  const indexes = context.paths.get(body.path);
  const source =
    indexes?.project?.get(body.id) ?? indexes?.global?.get(body.id);
  if (!source) {
    throw new Error("Source is no longer in this scan. Rescan and try again.");
  }
  await context.desktop(await desktopRequest(body.action, source));
}
