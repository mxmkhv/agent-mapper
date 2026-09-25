import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { resolveInventory, type InventorySnapshot } from "@agent-mapper/core";
import { scanInventory, type ScanOptions } from "./inventory";
export { createAppServer } from "./server";

export async function buildSnapshot(
  workingDirectory: string,
  options: Omit<ScanOptions, "workingDirectory"> = {}
): Promise<InventorySnapshot> {
  const requestedPath = resolve(workingDirectory);
  let path: string;
  try {
    path = await realpath(requestedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${requestedPath} does not exist. Choose an existing folder.`
      );
    }
    throw error;
  }
  if (!(await stat(path)).isDirectory()) {
    throw new Error(`${path} is not a folder. Choose an existing folder.`);
  }
  const scan = await scanInventory({ ...options, workingDirectory: path });
  return {
    workingDirectory: path,
    scannedAt: new Date().toISOString(),
    roots: scan.roots,
    items: [
      ...resolveInventory(scan.entries, {
        workingDirectory: path,
        tool: "claude"
      }),
      ...resolveInventory(scan.entries, {
        workingDirectory: path,
        tool: "codex"
      })
    ],
    coverage: [
      ...scan.errors,
      "This view models a fresh local CLI session. Runtime flags, account-managed settings, and live session state are not inspected."
    ]
  };
}

export async function buildGlobalSnapshot(
  options: Omit<ScanOptions, "workingDirectory"> = {}
): Promise<InventorySnapshot> {
  const snapshot = await buildSnapshot(options.home ?? homedir(), options);
  return {
    ...snapshot,
    items: snapshot.items.filter(({ entry }) => entry.scope === "global")
  };
}
