import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { InventoryEntry, ToolId } from "@agent-mapper/core";

const frontmatterStart = 4;
const frontmatterEndLength = 4;
const idLength = 20;
interface SkillMetadata {
  name?: string;
  characters?: number;
}

export interface Candidate {
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

export interface SourceRead {
  state: InventoryEntry["readState"];
  content: string;
  isSymlink: boolean;
  realPath?: string;
  error?: string;
}

export function lineCount(content: string): number {
  if (!content) {
    return 0;
  }
  const lines = content.split(/\r\n|\n|\r/).length;
  return lines - Number(/[\r\n]$/.test(content));
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
  return {
    name,
    characters: end + frontmatterEndLength
  };
}

export async function readSource(
  path: string
): Promise<SourceRead | undefined> {
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
      isSymlink: false,
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
      isSymlink: info.isSymbolicLink(),
      realPath
    };
  } catch (error) {
    return {
      state:
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "missing"
          : "unreadable",
      content: "",
      isSymlink: info.isSymbolicLink(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function makeEntry(options: {
  candidate: Candidate;
  source: SourceRead;
  key: string;
}): InventoryEntry {
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
    isSymlink: source.isSymlink,
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
