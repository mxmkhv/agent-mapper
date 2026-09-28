import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type { InstructionImport, ResolvedEntry } from "@agent-mapper/core";

const maxDepth = 4;
const idLength = 20;

function withoutInlineCode(line: string, state: { ticks: number }): string {
  let visible = "";
  for (let index = 0; index < line.length;) {
    if (line[index] === "`") {
      let end = index + 1;
      while (line[end] === "`") {
        end += 1;
      }
      const length = end - index;
      if (state.ticks === 0) {
        state.ticks = length;
      } else if (state.ticks === length) {
        state.ticks = 0;
      }
      visible += " ".repeat(length);
      index = end;
    } else {
      visible += state.ticks === 0 ? line[index] : " ";
      index += 1;
    }
  }
  return visible;
}

function importPaths(content: string): string[] {
  const paths: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  const inline = { ticks: 0 };
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === "") {
      inline.ticks = 0;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence.marker && marker.length >= fence.length) {
        fence = undefined;
      }
      continue;
    }
    if (marker && inline.ticks === 0) {
      fence = { marker: marker[0]!, length: marker.length };
      continue;
    }
    const visible = withoutInlineCode(line, inline);
    for (const match of visible.matchAll(/(^|[\s([{])@([^\s`<>()[\]{}"']+)/g)) {
      const path = match[2];
      if (path) {
        paths.push(path);
      }
    }
  }
  return paths;
}

function targetPath(options: {
  sourcePath: string;
  path: string;
  home: string;
}): string {
  const { sourcePath, path, home } = options;
  if (path === "~") {
    return home;
  }
  if (path.startsWith("~/")) {
    return resolve(home, path.slice(2));
  }
  return isAbsolute(path) ? resolve(path) : resolve(dirname(sourcePath), path);
}

function outsideWorkingDirectory(
  path: string,
  workingDirectory: string
): boolean {
  return (
    path !== workingDirectory && !path.startsWith(`${workingDirectory}${sep}`)
  );
}

function importId(options: {
  rootId: string;
  sourcePath: string;
  target: string;
}): string {
  return createHash("sha256")
    .update(`${options.rootId}:${options.sourcePath}:${options.target}`)
    .digest("hex")
    .slice(0, idLength);
}

interface VisitOptions {
  content: string;
  sourcePath: string;
  root: ResolvedEntry;
  depth: number;
  ancestors: Set<string>;
  home: string;
  workingDirectory: string;
  imports: InstructionImport[];
  seen: Set<string>;
}

async function readTarget(
  target: string
): Promise<
  | { content: string; physicalPath: string; error?: never }
  | { content?: never; physicalPath?: never; error: unknown }
> {
  try {
    if (!(await stat(target)).isFile()) {
      throw new Error("The import target is not a regular file.");
    }
    return {
      physicalPath: await realpath(target),
      content: await readFile(target, "utf8")
    };
  } catch (error) {
    return { error };
  }
}

async function recordImport(options: VisitOptions, path: string) {
  const { sourcePath, root, depth, imports, seen } = options;
  const target = targetPath({ sourcePath, path, home: options.home });
  const id = importId({ rootId: root.entry.id, sourcePath, target });
  if (seen.has(id)) {
    return undefined;
  }
  seen.add(id);
  const base = {
    id,
    sourceEntryId: root.entry.id,
    sourcePath,
    targetPath: target,
    depth
  };
  if (/[.,;:!?]$/.test(path)) {
    imports.push({
      ...base,
      state: "syntax-unknown",
      reason:
        "The @path token ends in punctuation. Claude Code 2.1.283 did not load this form in a controlled run."
    });
    return undefined;
  }
  const result = await readTarget(target);
  if ("error" in result) {
    const missing = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    imports.push({
      ...base,
      state: missing ? "missing" : "unreadable",
      reason: missing
        ? "The explicit import target does not exist."
        : `The explicit import target could not be read: ${result.error instanceof Error ? result.error.message : String(result.error)}`
    });
    return undefined;
  }
  const external =
    root.entry.scope === "project" &&
    (outsideWorkingDirectory(target, options.workingDirectory) ||
      outsideWorkingDirectory(result.physicalPath, options.workingDirectory));
  imports.push({
    ...base,
    state: external ? "approval-unknown" : "readable",
    reason: external
      ? "Claude Code may require project approval for this external import; approval was not inspected."
      : "The explicit import target is readable."
  });
  return external ? undefined : { target, content: result.content };
}

async function visit(options: VisitOptions): Promise<void> {
  if (options.depth > maxDepth) {
    return;
  }
  for (const path of importPaths(options.content)) {
    const result = await recordImport(options, path);
    if (
      result &&
      options.depth < maxDepth &&
      !options.ancestors.has(result.target)
    ) {
      await visit({
        ...options,
        content: result.content,
        sourcePath: result.target,
        depth: options.depth + 1,
        ancestors: new Set([...options.ancestors, result.target])
      });
    }
  }
}

export async function scanInstructionImports(options: {
  items: ResolvedEntry[];
  home: string;
  workingDirectory: string;
  contentFor(path: string): string | undefined;
}): Promise<{ imports: InstructionImport[]; errors: string[] }> {
  const imports: InstructionImport[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const root of options.items) {
    if (
      root.entry.tool !== "claude" ||
      root.entry.kind !== "instruction" ||
      root.entry.inlineContent ||
      root.resolution.availability !== "expected" ||
      root.entry.readState !== "readable"
    ) {
      continue;
    }
    try {
      const content =
        options.contentFor(root.entry.path) ??
        (await readFile(root.entry.path, "utf8"));
      await visit({
        ...options,
        content,
        root,
        sourcePath: root.entry.path,
        depth: 1,
        ancestors: new Set([root.entry.path]),
        imports,
        seen
      });
    } catch (error) {
      errors.push(
        `${root.entry.path}: Import scan failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return { imports, errors };
}
