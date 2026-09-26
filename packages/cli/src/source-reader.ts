import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { InventoryEntry, ToolId } from "@agent-mapper/core";

const frontmatterStart = 4;
const frontmatterEndLength = 4;
const idLength = 20;
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

export class SourceCollector {
  readonly entries: InventoryEntry[] = [];
  readonly errors: string[] = [];
  private readonly seen = new Set<string>();

  async add(candidate: Candidate): Promise<void> {
    const key = `${candidate.tool}:${candidate.kind}:${candidate.path}`;
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
    const details =
      candidate.kind === "skill" ? skillMetadata(source.content) : {};
    const item: InventoryEntry = {
      id: createHash("sha256").update(key).digest("hex").slice(0, idLength),
      tool: candidate.tool,
      kind: candidate.kind,
      name:
        candidate.kind === "skill"
          ? (details.name ?? basename(dirname(candidate.path)))
          : basename(candidate.path),
      path: candidate.path,
      scope: candidate.scope,
      readState: source.state,
      isSymlink: await isSymlink(candidate.path)
    };
    if (source.realPath) {
      item.realPath = source.realPath;
    }
    if (candidate.projectPath) {
      item.projectPath = candidate.projectPath;
    }
    if (candidate.pluginId) {
      item.pluginId = candidate.pluginId;
    }
    if (source.state === "readable") {
      item.characters = source.content.length;
      if (details.characters !== undefined) {
        item.metadataCharacters = details.characters;
      }
    }
    if (source.error) {
      item.error = source.error;
    }
    this.entries.push(item);
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
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}
