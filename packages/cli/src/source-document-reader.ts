import type { Stats } from "node:fs";
import { constants } from "node:fs";
import { access, open, realpath } from "node:fs/promises";
import { basename, dirname, sep } from "node:path";
import type { InventoryEntry } from "@agent-mapper/core";
import {
  decodeDocument,
  maxDocumentBytes,
  versionFor,
  type DecodedDocument
} from "./source-document-bytes";
import {
  DocumentApiError,
  documentError,
  errnoCode,
  ioError
} from "./source-document-errors";

export interface TargetState {
  canonicalPath: string;
  stats: Stats;
  bytes: Buffer;
  version: string;
  decoded: DecodedDocument;
}

/** Resolves the full path, including symlinked parent folders, to the file that would be written. */
export async function canonicalTarget(entryPath: string): Promise<string> {
  try {
    return await realpath(entryPath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      throw documentError(
        "not_found",
        `${entryPath} no longer exists. Rescan to update the inventory.`
      );
    }
    throw ioError(error, `Resolving ${entryPath}`);
  }
}

async function readBounded(canonicalPath: string) {
  const handle = await open(canonicalPath, "r");
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw documentError(
        "invalid_request",
        `${canonicalPath} is not a regular file. Use Open or Reveal instead.`
      );
    }
    if (stats.size > maxDocumentBytes) {
      throw documentError(
        "too_large",
        `${canonicalPath} is larger than 1 MiB. Use Open to edit it in another editor.`
      );
    }
    return { stats, bytes: await handle.readFile() };
  } finally {
    await handle.close();
  }
}

/** Reads bytes and identity from one open file descriptor so they describe the same inode. */
export async function readTarget(canonicalPath: string): Promise<TargetState> {
  let read;
  try {
    read = await readBounded(canonicalPath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      throw documentError(
        "not_found",
        `${canonicalPath} no longer exists. Rescan to update the inventory.`
      );
    }
    throw error instanceof DocumentApiError
      ? error
      : ioError(error, `Reading ${canonicalPath}`);
  }
  // The file can grow between fstat and readFile; check what was actually read.
  if (read.bytes.length > maxDocumentBytes) {
    throw documentError(
      "too_large",
      `${canonicalPath} is larger than 1 MiB. Use Open to edit it in another editor.`
    );
  }
  const decoded = decodeDocument(read.bytes);
  if (!decoded) {
    throw documentError(
      "invalid_encoding",
      `${canonicalPath} is not UTF-8 text. Use Open to inspect it in another editor.`
    );
  }
  return {
    canonicalPath,
    stats: read.stats,
    bytes: read.bytes,
    decoded,
    version: versionFor({ canonicalPath, stats: read.stats }, read.bytes)
  };
}

const inside = (path: string, root: string) =>
  path === root || path.startsWith(`${root}${sep}`);

async function realRoots(roots: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(
    roots.map((root) =>
      realpath(root).then(
        (path) => [root, path],
        // A root that does not exist on disk can only match by its literal path.
        () => [root]
      )
    )
  );
  return resolved.flat();
}

/** Why this entry must stay read-only by policy, before looking at the file itself. */
async function policyReason(input: {
  entry: InventoryEntry;
  canonicalPath: string;
  readOnlyRoots: readonly string[];
}): Promise<string | undefined> {
  const { entry, canonicalPath } = input;
  if (entry.scope === "managed") {
    return "Managed configuration is read-only here.";
  }
  if (entry.pluginId) {
    return "Installed plugin files are read-only. Edit the plugin's own source instead.";
  }
  if (entry.scope === "unknown") {
    return "This file's scope is unknown, so agent-mapper will not edit it.";
  }
  if (entry.kind === "skill" && basename(canonicalPath) !== "SKILL.md") {
    return "Only SKILL.md files can be edited in this release.";
  }
  const roots = await realRoots(input.readOnlyRoots);
  if (roots.some((root) => inside(canonicalPath, root))) {
    return "This file resolves into a plugin or managed folder, which is read-only.";
  }
  return undefined;
}

async function writable(path: string, mode: number): Promise<boolean> {
  return access(path, mode).then(
    () => true,
    // access() reports a missing permission only by rejecting.
    () => false
  );
}

/** Why the file on disk cannot be safely replaced, if it cannot. */
async function fileReason(target: TargetState): Promise<string | undefined> {
  if (target.stats.nlink > 1) {
    return "This file has several hard links. Saving would split them, so edit it in another editor.";
  }
  if (process.getuid && target.stats.uid !== process.getuid()) {
    return "This file belongs to another user. Saving would change its owner.";
  }
  if (target.decoded.lineEnding === "mixed") {
    return "This file mixes line endings. Saving would normalize them, so edit it in another editor.";
  }
  if (!(await writable(target.canonicalPath, constants.W_OK))) {
    return "You do not have permission to write this file.";
  }
  if (
    !(await writable(
      dirname(target.canonicalPath),
      constants.W_OK | constants.X_OK
    ))
  ) {
    return "The folder containing this file is not writable, and saving replaces the file inside it.";
  }
  return undefined;
}

export async function readOnlyReason(input: {
  entry: InventoryEntry;
  target: TargetState;
  readOnlyRoots: readonly string[];
}): Promise<string | undefined> {
  return (
    (await policyReason({
      entry: input.entry,
      canonicalPath: input.target.canonicalPath,
      readOnlyRoots: input.readOnlyRoots
    })) ?? (await fileReason(input.target))
  );
}
