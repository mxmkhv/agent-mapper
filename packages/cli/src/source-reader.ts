import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import type { InventoryEntry, ToolId } from "@agent-mapper/core";

const frontmatterStart = 4;
const frontmatterEndLength = 4;
const idLength = 20;
function lineCount(content: string): number {
  if (!content) {
    return 0;
  }
  const lines = content.split(/\r\n|\n|\r/).length;
  return lines - Number(/[\r\n]$/.test(content));
}
interface SkillMetadata {
  name?: string;
  characters?: number;
}

interface Candidate {
  tool: ToolId;
  kind: InventoryEntry["kind"];
  path: string;
  scope: InventoryEntry["scope"];
  projectPath?: string;
  pluginId?: string;
  name?: string;
  locator?: string;
  declarationOnly?: boolean;
}

interface SourceRead {
  state: InventoryEntry["readState"];
  content: string;
  realPath?: string;
  error?: string;
}

function skillMetadata(content: string): SkillMetadata {
  if (!content.startsWith("---\n")) {
    return {};
  }
  const end = content.indexOf("\n---", frontmatterStart);
  if (end < 0) {
    return {};
  }
  const header = content.slice(frontmatterStart, end);
  const name = /^name:\s*(.+)$/m.exec(header)?.[1]?.trim();
  const result: SkillMetadata = {};
  if (name) {
    result.name = name;
  }
  result.characters = end + frontmatterEndLength;
  return result;
}

async function readSource(path: string): Promise<SourceRead | undefined> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    return {
      state: "unreadable",
      content: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  if (!info.isFile() && !info.isSymbolicLink()) {
    return undefined;
  }
  try {
    const realPath = await realpath(path);
    return {
      state: "readable",
      content: await readFile(path, "utf8"),
      realPath
    };
  } catch (error) {
    return {
      state:
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "missing"
          : "unreadable",
      content: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function makeEntry(options: {
  candidate: Candidate;
  source: SourceRead;
  key: string;
}): Promise<InventoryEntry> {
  const { candidate, source, key } = options;
  const details =
    !candidate.declarationOnly &&
    (candidate.kind === "skill" || candidate.kind === "command")
      ? skillMetadata(source.content)
      : {};
  const readable = source.state === "readable" && !candidate.declarationOnly;
  return {
    id: createHash("sha256").update(key).digest("hex").slice(0, idLength),
    tool: candidate.tool,
    kind: candidate.kind,
    name:
      candidate.kind === "skill"
        ? (details.name ?? basename(dirname(candidate.path)))
        : (candidate.name ?? basename(candidate.path)),
    path: candidate.path,
    scope: candidate.scope,
    readState: source.state,
    isSymlink: await isSymlink(candidate.path),
    realPath: source.realPath,
    projectPath: candidate.projectPath,
    pluginId: candidate.pluginId,
    locator: candidate.locator,
    declarationOnly: candidate.declarationOnly,
    characters: readable ? source.content.length : undefined,
    lineCount: readable ? lineCount(source.content) : undefined,
    metadataCharacters: readable ? details.characters : undefined,
    error: source.error
  };
}

export class SourceCollector {
  readonly entries: InventoryEntry[] = [];
  readonly errors: string[] = [];
  private readonly seen = new Set<string>();

  async add(candidate: Candidate): Promise<void> {
    const key = `${candidate.tool}:${candidate.kind}:${candidate.path}:${candidate.locator ?? candidate.name ?? ""}`;
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    const source = await readSource(candidate.path);
    if (!source) {
      return;
    }
    if (source.error) {
      this.errors.push(`${candidate.path}: ${source.error}`);
    }
    this.entries.push(await makeEntry({ candidate, source, key }));
  }

  addInline(candidate: Candidate, content: string): void {
    const key = `${candidate.tool}:${candidate.kind}:${candidate.path}:${candidate.locator ?? candidate.name ?? ""}`;
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.entries.push({
      id: createHash("sha256").update(key).digest("hex").slice(0, idLength),
      tool: candidate.tool,
      kind: candidate.kind,
      name: candidate.name ?? basename(candidate.path),
      path: candidate.path,
      scope: candidate.scope,
      readState: "readable",
      isSymlink: false,
      locator: candidate.locator,
      inlineContent: true,
      characters: content.length,
      lineCount: lineCount(content)
    });
  }

  async addSkills(
    candidate: Omit<Candidate, "path" | "kind"> & { directory: string }
  ): Promise<void> {
    let children;
    try {
      children = await readdir(candidate.directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.errors.push(
          `${candidate.directory}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return;
    }
    for (const child of children) {
      if (child.isDirectory() || child.isSymbolicLink()) {
        await this.add({
          ...candidate,
          kind: "skill",
          path: join(candidate.directory, child.name, "SKILL.md")
        });
      }
    }
  }

  async addCommands(
    candidate: Omit<Candidate, "path" | "kind" | "name"> & {
      directory: string;
    }
  ): Promise<void> {
    const pending = [candidate.directory];
    while (pending.length) {
      const directory = pending.pop()!;
      let children;
      try {
        children = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.errors.push(
            `${directory}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        continue;
      }
      for (const child of children) {
        const path = join(directory, child.name);
        if (child.isDirectory()) {
          pending.push(path);
        } else if (
          child.name.endsWith(".md") &&
          (child.isFile() || child.isSymbolicLink())
        ) {
          await this.add({
            ...candidate,
            kind: "command",
            path,
            name: relative(candidate.directory, path)
              .slice(0, -".md".length)
              .split(sep)
              .join(":")
          });
        }
      }
    }
  }
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}
