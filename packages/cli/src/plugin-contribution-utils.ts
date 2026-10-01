import { readdir, realpath, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { PluginContribution } from "@agent-mapper/core";

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }
    throw new Error(
      `${path}: Could not inspect plugin file. Check permissions.`,
      {
        cause: error
      }
    );
  }
}

export async function safePath(
  root: string,
  relative: string
): Promise<string | undefined> {
  if (relative !== "." && !relative.startsWith("./")) {
    return undefined;
  }
  const path = resolve(root, relative);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    return undefined;
  }
  try {
    const target = await realpath(path);
    const realRoot = await realpath(root);
    return target === realRoot || target.startsWith(`${realRoot}${sep}`)
      ? path
      : undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return undefined;
    }
    throw new Error(
      `${path}: Could not resolve plugin path. Check permissions.`,
      {
        cause: error
      }
    );
  }
}

export function paths(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export async function skillFiles(
  directory: string,
  errors: string[]
): Promise<string[]> {
  if (await fileExists(join(directory, "SKILL.md"))) {
    return [join(directory, "SKILL.md")];
  }
  try {
    const children = await readdir(directory, { withFileTypes: true });
    return children
      .filter((child) => child.isDirectory() || child.isSymbolicLink())
      .map((child) => join(directory, child.name, "SKILL.md"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${directory}: Could not list plugin skills. Check permissions.`
      );
    }
    return [];
  }
}

const maxMarkdownDepth = 6;

export async function markdownFiles(
  directory: string,
  options: { errors: string[]; depth?: number }
): Promise<string[]> {
  const depth = options.depth ?? 0;
  try {
    const children = await readdir(directory, { withFileTypes: true });
    const files = children
      .filter((child) => child.isFile() && extname(child.name) === ".md")
      .map((child) => join(directory, child.name));
    if (depth >= maxMarkdownDepth) {
      return files;
    }
    for (const child of children.filter((item) => item.isDirectory())) {
      files.push(
        ...(await markdownFiles(join(directory, child.name), {
          ...options,
          depth: depth + 1
        }))
      );
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      options.errors.push(
        `${directory}: Could not list plugin Markdown files. Check permissions.`
      );
    }
    return [];
  }
}

export function addContribution(
  contributions: PluginContribution[],
  item: PluginContribution
): void {
  if (
    !contributions.some(
      (existing) =>
        existing.kind === item.kind &&
        existing.name === item.name &&
        existing.sourcePath === item.sourcePath
    )
  ) {
    contributions.push(item);
  }
}
