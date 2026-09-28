import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { MemoryRecord } from "@agent-mapper/core";

const idLength = 20;
const newlineByte = 10;

export interface MemorySource {
  path: string;
  tool: MemoryRecord["tool"];
  scope: MemoryRecord["scope"];
  projectMatch: MemoryRecord["projectMatch"];
  loading: MemoryRecord["loading"];
  reason: string;
}

async function countLines(path: string): Promise<number> {
  let newlines = 0;
  let bytes = 0;
  let lastByte = newlineByte;
  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (const byte of buffer) {
      if (byte === newlineByte) {
        newlines += 1;
      }
    }
    bytes += buffer.length;
    lastByte = buffer.at(-1) ?? lastByte;
  }
  return newlines + Number(bytes > 0 && lastByte !== newlineByte);
}

export async function inspectMemory(
  source: MemorySource
): Promise<MemoryRecord | undefined> {
  let metadata;
  try {
    metadata = await lstat(source.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw new Error(
      `${source.path}: Could not inspect memory file. Check file permissions.`,
      { cause: error }
    );
  }
  const base: MemoryRecord = {
    id: createHash("sha256")
      .update(`${source.tool}:${source.path}`)
      .digest("hex")
      .slice(0, idLength),
    tool: source.tool,
    name: basename(source.path),
    sourcePath: source.path,
    scope: source.scope,
    projectMatch: source.projectMatch,
    loading: source.loading,
    readState: "unreadable",
    modifiedAt: metadata.mtime.toISOString(),
    reason: source.reason
  };
  try {
    const target = await stat(source.path);
    if (!target.isFile()) {
      return undefined;
    }
    return {
      ...base,
      readState: "readable",
      sizeBytes: target.size,
      lineCount: await countLines(source.path),
      modifiedAt: target.mtime.toISOString()
    };
  } catch {
    return {
      ...base,
      error:
        "Could not read this memory file. Open the source and check its target or permissions."
    };
  }
}
