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
  candidateDirectories?: Set<string>;
}

function shouldEnter(
  options: VisitOptions,
  child: { parts: string[]; name: string; relativePath: string }
): boolean {
  const { parts, name, relativePath } = child;
  return (
    canEnter(parts, name) &&
    (options.candidateDirectories === undefined ||
      isConfigLink(parts, name) ||
      options.candidateDirectories.has(relativePath))
  );
}

function candidateDirectories(
  files: Set<string> | undefined
): Set<string> | undefined {
  if (!files) {
    return undefined;
  }
  const directories = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    const name = parts.at(-1) ?? "";
    const parent = parts.slice(0, -1);
    if (!included(parent, name) && !isConfigLink(parent, name)) {
      continue;
    }
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(join(...parts.slice(0, index)));
    }
  }
  return directories;
}

async function visitConfigLink(
  root: string,
  context: {
    options: VisitOptions;
    child: Dirent;
    parts: string[];
    ancestors: Set<string>;
    relativePath: string;
  }
): Promise<void> {
  const { options, child, parts, ancestors, relativePath } = context;
  const path = join(root, relativePath);
  let target;
  try {
    target = await stat(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      options.errors.push(
        `${path}: Configuration link target is missing. Repair the link.`
      );
    } else {
      options.errors.push(
        `${path}: Could not inspect configuration link. Check permissions.`
      );
    }
  }
  if (target?.isDirectory()) {
    options.files.set(
      relativePath,
      await recordDirectoryLink({ root, relativePath, errors: options.errors })
    );
    await visit(root, { ...options, relative: relativePath, ancestors });
  } else if (included(parts, child.name)) {
    options.files.set(
      relativePath,
      await record({ root, relativePath, errors: options.errors })
    );
  }
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
  if (
    child.isDirectory() &&
    shouldEnter(options, { parts, name: child.name, relativePath })
  ) {
    await visit(root, { ...options, relative: relativePath, ancestors });
  } else if (
    child.isSymbolicLink() &&
    canEnter(parts, child.name) &&
    isConfigLink(parts, child.name)
  ) {
    await visitConfigLink(root, {
      options,
      child,
      parts,
      ancestors,
      relativePath
    });
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
  options: { excludedRoots?: Set<string>; candidates?: Set<string> } = {}
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
    excludedRoots: options.excludedRoots ?? new Set(),
    candidateDirectories: candidateDirectories(options.candidates)
  });
  return { files, errors };
}
