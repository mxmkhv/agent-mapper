import { createHash } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { InventoryEntry, ToolId } from "@agent-mapper/core";
import {
  declaredMetadata,
  type DeclaredMetadata
} from "./source-document-validation";

const idLength = 20;

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

/** Identifies one candidate across scans; skills found by folder carry no name or locator. */
export function candidateKey(
  candidate: Pick<Candidate, "tool" | "kind" | "path" | "locator" | "name">
): string {
  return `${candidate.tool}:${candidate.kind}:${candidate.path}:${candidate.locator ?? candidate.name ?? ""}`;
}

export function entryIdFor(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, idLength);
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

/** Instruction and skill files are text; anything larger is not something either tool loads whole. */
const maxSourceBytes = 10_485_760;

function unreadable(isSymlink: boolean, error: string): SourceRead {
  return { state: "unreadable", content: "", isSymlink, error };
}

/** Only a regular file under the size cap is read: a link to a pipe, socket or device would block forever. */
async function readTarget(
  path: string,
  isSymlink: boolean
): Promise<SourceRead> {
  const target = await stat(path);
  if (!target.isFile()) {
    return unreadable(
      isSymlink,
      "The link leads to something other than a regular file, so it was not read. Point it at a file."
    );
  }
  if (target.size > maxSourceBytes) {
    return unreadable(
      isSymlink,
      "The file is larger than 10 MiB, so it was not read. Open it in an editor to review it."
    );
  }
  return {
    state: "readable",
    realPath: await realpath(path),
    content: await readFile(path, "utf8"),
    isSymlink
  };
}

/** Reads a source file or the file a link leads to. */
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
    return unreadable(
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
  if (!info.isFile() && !info.isSymbolicLink()) {
    return undefined;
  }
  try {
    return await readTarget(path, info.isSymbolicLink());
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
  const details: DeclaredMetadata =
    source.state === "readable" &&
    !candidate.declarationOnly &&
    (candidate.kind === "skill" || candidate.kind === "command")
      ? declaredMetadata(source.content, candidate.kind)
      : {};
  const readable = source.state === "readable" && !candidate.declarationOnly;
  return {
    id: entryIdFor(key),
    tool: candidate.tool,
    kind: candidate.kind,
    name:
      candidate.kind === "skill"
        ? (details.name ?? candidate.name ?? basename(dirname(candidate.path)))
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
    error: source.error ?? details.problem
  };
}
