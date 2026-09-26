import { readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { MemoryRecord } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import { inspectMemory, type MemorySource } from "./memory-record";

interface ScanOptions {
  workingDirectory: string;
  home: string;
  codexHome: string;
}

async function globalView(options: ScanOptions): Promise<boolean> {
  try {
    return (
      (await realpath(options.workingDirectory)) ===
      (await realpath(options.home))
    );
  } catch {
    return resolve(options.workingDirectory) === resolve(options.home);
  }
}

async function children(path: string, errors: string[]) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: Could not list memory directory. Check file permissions.`
      );
    }
    return [];
  }
}

async function append(
  records: MemoryRecord[],
  options: { source: MemorySource; errors: string[] }
): Promise<void> {
  const { source, errors } = options;
  try {
    const record = await inspectMemory(source);
    if (record) {
      records.push(record);
    }
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : `${source.path}: Could not inspect memory file.`
    );
  }
}

async function scanMarkdown(
  records: MemoryRecord[],
  options: {
    directory: string;
    source: Omit<MemorySource, "path">;
    errors: string[];
  }
): Promise<void> {
  for (const item of await children(options.directory, options.errors)) {
    const path = join(options.directory, item.name);
    if (item.isDirectory()) {
      await scanMarkdown(records, { ...options, directory: path });
    } else if (
      item.name.endsWith(".md") &&
      (item.isFile() || item.isSymbolicLink())
    ) {
      await append(records, {
        source: { ...options.source, path },
        errors: options.errors
      });
    }
  }
}

function claudeSource(
  path: string,
  candidate: boolean
): Omit<MemorySource, "path"> {
  return {
    tool: "claude",
    scope: candidate ? "project" : "unknown",
    projectMatch: candidate ? "candidate" : "unmatched",
    loading: path.endsWith("/MEMORY.md") ? "startup index" : "on demand",
    reason: candidate
      ? "Folder name is consistent with the selected repository, but encoded names can collide. Project attribution is unverified."
      : "The project cannot be identified from this encoded folder name alone."
  };
}

async function scanClaude(
  records: MemoryRecord[],
  input: { options: ScanOptions; errors: string[]; global: boolean }
): Promise<void> {
  const { options, errors, global } = input;
  const projects = join(options.home, ".claude", "projects");
  const root =
    (await findGitRoot(options.workingDirectory, "/")) ??
    options.workingDirectory;
  const names = global
    ? (await children(projects, errors))
        .filter((item) => item.isDirectory())
        .map((item) => item.name)
    : [root.replace(/[^A-Za-z0-9]/g, "-")];
  for (const name of names) {
    const directory = join(projects, name, "memory");
    for (const item of await children(directory, errors)) {
      if (
        !item.name.endsWith(".md") ||
        !(item.isFile() || item.isSymbolicLink())
      ) {
        continue;
      }
      const path = join(directory, item.name);
      await append(records, {
        source: { ...claudeSource(path, !global), path },
        errors
      });
    }
  }
}

export async function scanMemory(
  options: ScanOptions
): Promise<{ memories: MemoryRecord[]; errors: string[] }> {
  const memories: MemoryRecord[] = [];
  const errors: string[] = [];
  const global = await globalView(options);
  await scanMarkdown(memories, {
    directory: join(options.codexHome, "memories"),
    source: {
      tool: "codex",
      scope: "global",
      projectMatch: "not applicable",
      loading: "unknown",
      reason:
        "Stored in Codex's local memory directory; use in a session was not checked."
    },
    errors
  });
  await scanClaude(memories, { options, errors, global });
  const agentPath = global
    ? join(options.home, ".agents", "MEMORY.md")
    : join(options.workingDirectory, ".agents", "MEMORY.md");
  await append(memories, {
    source: {
      path: agentPath,
      tool: "unknown",
      scope: global ? "global" : "project",
      projectMatch: global ? "not applicable" : "matched",
      loading: "unknown",
      reason: "Writer and loading behavior are unknown for this file."
    },
    errors
  });
  return { memories, errors };
}
