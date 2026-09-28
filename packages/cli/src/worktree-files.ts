import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  lstat,
  readFile,
  readlink,
  readdir,
  realpath,
  stat
} from "node:fs/promises";
import { join } from "node:path";
import type { WorktreeDifference } from "@agent-mapper/core";
import { canEnter, included, isConfigLink, kind, tool } from "./worktree-paths";

type Kind = WorktreeDifference["kind"];
export interface ConfigFile {
  relativePath: string;
  path: string;
  kind: Kind;
  tool: WorktreeDifference["tool"];
  fingerprint?: string;
  readState: "readable" | "unreadable";
}

async function recordDirectoryLink(options: {
  root: string;
  relativePath: string;
  errors: string[];
}): Promise<ConfigFile> {
  const { root, relativePath, errors } = options;
  const path = join(root, relativePath);
  const base = {
    path,
    relativePath,
    kind: kind(relativePath),
    tool: tool(relativePath)
  };
  try {
    const target = await readlink(path);
    const fingerprint = createHash("sha256").update(target).digest("hex");
    return { ...base, fingerprint, readState: "readable" };
  } catch {
    errors.push(
      `${path}: Could not read configuration link. Check permissions.`
    );
    return { ...base, readState: "unreadable" };
  }
}

async function record(options: {
  root: string;
  relativePath: string;
  errors: string[];
}): Promise<ConfigFile> {
  const { root, relativePath, errors } = options;
  const path = join(root, relativePath);
  const base = {
    path,
    relativePath,
    kind: kind(relativePath),
    tool: tool(relativePath)
  };
  try {
    const info = await lstat(path);
    const bytes = await readFile(path);
    const link = info.isSymbolicLink() ? await readlink(path) : "";
    const fingerprint = createHash("sha256")
      .update(link)
      .update(bytes)
      .digest("hex");
    return { ...base, fingerprint, readState: "readable" };
  } catch {
    errors.push(
      `${path}: Could not read configuration file. Check permissions.`
    );
    return { ...base, readState: "unreadable" };
  }
}

interface VisitOptions {
  relative: string;
  files: Map<string, ConfigFile>;
  errors: string[];
  ancestors: Set<string>;
  excludedRoots: Set<string>;
}

async function visitChild(
  root: string,
  context: {
    options: VisitOptions;
    child: Dirent;
    parts: string[];
    ancestors: Set<string>;
  }
): Promise<void> {
  const { options, child, parts, ancestors } = context;
  const relativePath = join(options.relative, child.name);
  if (options.excludedRoots.has(join(root, relativePath))) {
    return;
  }
  if (child.isDirectory() && canEnter(parts, child.name)) {
    await visit(root, { ...options, relative: relativePath, ancestors });
  } else if (
    child.isSymbolicLink() &&
    canEnter(parts, child.name) &&
    isConfigLink(parts, child.name)
  ) {
    const target = await stat(join(root, relativePath)).catch(() => undefined);
    if (target?.isDirectory()) {
      options.files.set(
        relativePath,
        await recordDirectoryLink({
          root,
          relativePath,
          errors: options.errors
        })
      );
      await visit(root, { ...options, relative: relativePath, ancestors });
    } else if (included(parts, child.name)) {
      options.files.set(
        relativePath,
        await record({ root, relativePath, errors: options.errors })
      );
    }
  } else if (
    (child.isFile() || child.isSymbolicLink()) &&
    included(parts, child.name)
  ) {
    options.files.set(
      relativePath,
      await record({ root, relativePath, errors: options.errors })
    );
  }
}

async function visit(root: string, options: VisitOptions): Promise<void> {
  const directory = join(root, options.relative);
  let canonical: string;
  try {
    canonical = await realpath(directory);
  } catch {
    options.errors.push(
      `${directory}: Could not resolve configuration directory. Check that it exists and is readable.`
    );
    return;
  }
  if (options.ancestors.has(canonical)) {
    options.errors.push(
      `${directory}: Configuration link creates a directory cycle. Inspect the link target.`
    );
    return;
  }
  const ancestors = new Set(options.ancestors);
  ancestors.add(canonical);
  let children;
  try {
    children = await readdir(directory, { withFileTypes: true });
  } catch {
    options.errors.push(
      `${directory}: Could not list configuration files. Check permissions.`
    );
    return;
  }
  const parts = options.relative ? options.relative.split("/") : [];
  for (const child of children) {
    await visitChild(root, { options, child, parts, ancestors });
  }
}

export async function configFiles(
  root: string,
  excludedRoots: Set<string> = new Set()
): Promise<{
  files: Map<string, ConfigFile>;
  errors: string[];
}> {
  const files = new Map<string, ConfigFile>();
  const errors: string[] = [];
  await visit(root, {
    relative: "",
    files,
    errors,
    ancestors: new Set(),
    excludedRoots
  });
  return { files, errors };
}
