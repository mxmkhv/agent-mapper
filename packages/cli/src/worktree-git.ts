import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { WorktreeRecord } from "@agent-mapper/core";

const run = promisify(execFile);
const bytesPerKilobyte = 1024;
const outputMegabytes = 10;
const gitOutputLimit = outputMegabytes * bytesPerKilobyte * bytesPerKilobyte;

async function git(directory: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, {
    cwd: directory,
    encoding: "utf8",
    maxBuffer: gitOutputLimit
  });
  return stdout;
}

interface ParsedWorktree {
  path: string;
  branch?: string;
  head?: string;
  prunable: boolean;
  bare: boolean;
}

function parsePorcelain(output: string): ParsedWorktree[] {
  const result: ParsedWorktree[] = [];
  let current: ParsedWorktree | undefined;
  for (const field of output.split("\0")) {
    if (!field) {
      if (current) {
        result.push(current);
        current = undefined;
      }
    } else if (field.startsWith("worktree ")) {
      if (current) {
        result.push(current);
      }
      current = {
        path: field.slice("worktree ".length),
        prunable: false,
        bare: false
      };
    } else if (current && field.startsWith("branch refs/heads/")) {
      current.branch = field.slice("branch refs/heads/".length);
    } else if (current && field.startsWith("HEAD ")) {
      current.head = field.slice("HEAD ".length);
    } else if (current && field.startsWith("prunable")) {
      current.prunable = true;
    } else if (current && field === "bare") {
      current.bare = true;
    }
  }
  if (current) {
    result.push(current);
  }
  return result;
}

async function mainWorktreeIndex(
  records: ParsedWorktree[],
  errors: string[]
): Promise<number> {
  const first = records[0];
  if (!first?.bare) {
    return records.findIndex((record) => !record.bare);
  }
  try {
    const primaryBranch = (
      await git(first.path, ["symbolic-ref", "--quiet", "HEAD"])
    ).trim();
    const index = records.findIndex(
      (record) =>
        !record.bare && `refs/heads/${record.branch}` === primaryBranch
    );
    if (index >= 0) {
      return index;
    }
  } catch (error) {
    if ((error as { code?: string | number }).code !== 1) {
      errors.push(
        `${first.path}: Could not inspect bare repository HEAD. Run git symbolic-ref HEAD in this repository.`
      );
    }
  }
  return records.findIndex((record) => !record.bare);
}

async function worktreeRecords(
  records: ParsedWorktree[],
  errors: string[]
): Promise<WorktreeRecord[]> {
  const mainIndex = await mainWorktreeIndex(records, errors);
  return Promise.all(
    records.map(async (record, index) => ({
      path: record.path,
      isMain: index === mainIndex,
      state: await state(record, errors),
      branch: record.branch,
      head: record.head
    }))
  );
}

async function state(
  record: ParsedWorktree,
  errors: string[]
): Promise<WorktreeRecord["state"]> {
  if (record.prunable) {
    return "prunable";
  }
  try {
    await lstat(record.path);
    return "available";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return "missing";
    }
    errors.push(
      `${record.path}: Could not inspect worktree folder. Check permissions.`
    );
    return "unknown";
  }
}

async function hasGitMarker(directory: string): Promise<boolean> {
  let path = directory;
  for (;;) {
    try {
      await lstat(join(path, ".git"));
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        return true;
      }
      const parent = dirname(path);
      if (parent === path) {
        return false;
      }
      path = parent;
    }
  }
}

export interface WorktreeScan {
  selectedRoot?: string;
  worktrees: WorktreeRecord[];
  errors: string[];
}

export async function readWorktrees(directory: string): Promise<WorktreeScan> {
  let selectedRoot: string;
  try {
    selectedRoot = (
      await git(directory, ["rev-parse", "--show-toplevel"])
    ).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        worktrees: [],
        errors: ["Git is unavailable. Install Git to compare worktrees."]
      };
    }
    return {
      worktrees: [],
      errors: (await hasGitMarker(directory))
        ? [
            "Could not inspect Git worktrees. Run git status in this folder to inspect the checkout."
          ]
        : []
    };
  }
  try {
    const records = parsePorcelain(
      await git(directory, ["worktree", "list", "--porcelain", "-z"])
    );
    const errors: string[] = [];
    const worktrees = await worktreeRecords(records, errors);
    return { selectedRoot, worktrees, errors };
  } catch {
    return {
      selectedRoot,
      worktrees: [],
      errors: [
        "Could not list Git worktrees. Run git worktree list in this folder to inspect the repository."
      ]
    };
  }
}

export async function trackedFiles(
  directory: string,
  errors: string[]
): Promise<Set<string> | undefined> {
  try {
    const output = await git(directory, ["ls-files", "-z", "--cached"]);
    return new Set(output.split("\0").filter(Boolean));
  } catch {
    errors.push(
      `${directory}: Could not list tracked files. Run git ls-files in this checkout.`
    );
    return undefined;
  }
}

export async function untrackedFiles(
  directory: string,
  errors: string[]
): Promise<Set<string> | undefined> {
  try {
    const output = await git(directory, [
      "ls-files",
      "-z",
      "--others",
      "--exclude-standard"
    ]);
    return new Set(output.split("\0").filter(Boolean));
  } catch {
    errors.push(
      `${directory}: Could not list untracked files. Run git ls-files in this checkout; comparison will walk all directories.`
    );
    return undefined;
  }
}
