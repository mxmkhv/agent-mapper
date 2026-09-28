import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { extname } from "node:path";
import type { InventorySnapshot } from "@agent-mapper/core";

interface ActionContext {
  request: IncomingMessage;
  paths: SourcePathStore;
  launch?: (args: string[]) => Promise<void>;
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

async function readJson(
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

function launchOpen(args: string[]): Promise<void> {
  return new Promise((finish, reject) => {
    const child = spawn("open", args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? finish()
        : reject(new Error(`macOS open exited with status ${code}.`))
    );
  });
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

export async function openArguments(
  action: "open" | "reveal",
  source: string
): Promise<string[]> {
  if (action === "reveal" || !safeTextExtensions.has(extname(source))) {
    return ["-R", source];
  }
  try {
    return (await lstat(source)).isFile() ? [source] : ["-R", source];
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
  if (body.action !== "open" && body.action !== "reveal") {
    throw new Error("Choose Open or Reveal.");
  }
  const indexes = context.paths.get(body.path);
  const source =
    indexes?.project?.get(body.id) ?? indexes?.global?.get(body.id);
  if (!source) {
    throw new Error("Source is no longer in this scan. Rescan and try again.");
  }
  await (context.launch ?? launchOpen)(
    await openArguments(body.action, source)
  );
}
