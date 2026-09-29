import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename
} from "node:fs/promises";
import { join } from "node:path";
import type { RevisionSummary } from "@agent-mapper/core";
import { hashBytes, type DocumentFormat } from "./source-document-bytes";
import {
  DocumentApiError,
  documentError,
  errnoCode
} from "./source-document-errors";

const privateDirectory = 0o700;
const privateFile = 0o600;
const groupOrOtherBits = 0o077;
const revisionIdBytes = 12;
const revisionIdPattern = /^[a-f0-9]{24}$/;
const snapshotFormat = 1;

export interface StoredRevision {
  summary: Omit<RevisionSummary, "current">;
  bytes: Buffer;
  format: DocumentFormat;
}

interface SnapshotFile {
  format: typeof snapshotFormat;
  revisionId: string;
  capturedAt: string;
  kind: RevisionSummary["kind"];
  sourceKey: string;
  canonicalPath: string;
  hash: string;
  bytes: number;
  bom: boolean;
  lineEnding: DocumentFormat["lineEnding"];
  data: string;
}

/** macOS keeps app data in Application Support; Linux CI and CLI use the XDG data directory. */
export function defaultHistoryRoot(home: string): string {
  if (process.platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "agent-mapper",
      "revisions"
    );
  }
  const xdg = process.env.XDG_DATA_HOME;
  return join(
    xdg?.startsWith("/") ? xdg : join(home, ".local", "share"),
    "agent-mapper",
    "revisions"
  );
}

async function privateFolder(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: privateDirectory });
  const info = await lstat(path);
  const owned = !process.getuid || info.uid === process.getuid();
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    !owned ||
    info.mode & groupOrOtherBits
  ) {
    throw documentError(
      "history_unavailable",
      `History folder ${path} must be a private folder you own (not a symlink, mode 700). Fix it, then save again.`
    );
  }
}

/** The private history folder for one file, created on first use. Fails before any source write. */
export async function historyFolder(
  root: string,
  sourceKey: string
): Promise<string> {
  const folder = join(root, sourceKey);
  try {
    await privateFolder(root);
    await privateFolder(folder);
  } catch (error) {
    if (error instanceof DocumentApiError) {
      throw error;
    }
    throw documentError(
      "history_unavailable",
      `Could not prepare history folder ${folder} (${errnoCode(error) ?? String(error)}). Nothing was changed.`
    );
  }
  return folder;
}

/** Writes and flushes one immutable snapshot before the source file is touched. */
export async function writeSnapshot(
  folder: string,
  input: {
    kind: RevisionSummary["kind"];
    sourceKey: string;
    canonicalPath: string;
    bytes: Buffer;
    format: DocumentFormat;
  }
): Promise<string> {
  const revisionId = randomBytes(revisionIdBytes).toString("hex");
  const record: SnapshotFile = {
    format: snapshotFormat,
    revisionId,
    capturedAt: new Date().toISOString(),
    kind: input.kind,
    sourceKey: input.sourceKey,
    canonicalPath: input.canonicalPath,
    hash: hashBytes(input.bytes),
    bytes: input.bytes.length,
    bom: input.format.bom,
    lineEnding: input.format.lineEnding,
    data: input.bytes.toString("base64")
  };
  const path = join(folder, `${revisionId}.json`);
  const temporary = `${path}.tmp`;
  try {
    const handle = await open(temporary, "wx", privateFile);
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
  } catch (error) {
    throw documentError(
      "history_unavailable",
      `Could not save a history snapshot in ${folder} (${errnoCode(error) ?? String(error)}). Nothing was changed.`
    );
  }
  return revisionId;
}

function parseSnapshot(
  text: string,
  sourceKey: string
): StoredRevision | undefined {
  const record = JSON.parse(text) as Partial<SnapshotFile>;
  if (
    record.format !== snapshotFormat ||
    record.sourceKey !== sourceKey ||
    typeof record.data !== "string" ||
    typeof record.revisionId !== "string" ||
    typeof record.capturedAt !== "string" ||
    (record.kind !== "before-save" && record.kind !== "before-restore")
  ) {
    return undefined;
  }
  const bytes = Buffer.from(record.data, "base64");
  const hash = hashBytes(bytes);
  if (hash !== record.hash) {
    return undefined;
  }
  return {
    summary: {
      revisionId: record.revisionId,
      capturedAt: record.capturedAt,
      kind: record.kind,
      hash,
      bytes: bytes.length
    },
    bytes,
    format: { bom: Boolean(record.bom), lineEnding: record.lineEnding ?? "lf" }
  };
}

async function readSnapshotFile(
  folder: string,
  input: { revisionId: string; sourceKey: string }
): Promise<StoredRevision> {
  const path = join(folder, `${input.revisionId}.json`);
  let revision: StoredRevision | undefined;
  try {
    revision = parseSnapshot(await readFile(path, "utf8"), input.sourceKey);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      throw documentError(
        "not_found",
        "That saved version is not in this file's history."
      );
    }
    throw documentError(
      "history_unavailable",
      `Could not read history snapshot ${path}. Move it out of the history folder, then try again.`
    );
  }
  if (!revision) {
    throw documentError(
      "history_unavailable",
      `History snapshot ${path} is damaged or belongs to another file. Move it out of the history folder, then try again.`
    );
  }
  return revision;
}

export async function readSnapshot(
  folder: string,
  input: { revisionId: string; sourceKey: string }
): Promise<StoredRevision> {
  if (!revisionIdPattern.test(input.revisionId)) {
    throw documentError("not_found", "That saved version does not exist.");
  }
  return readSnapshotFile(folder, input);
}

/** Newest first. */
export async function listSnapshots(
  folder: string,
  sourceKey: string
): Promise<StoredRevision[]> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return [];
    }
    throw documentError(
      "history_unavailable",
      `Could not list history in ${folder} (${errnoCode(error) ?? String(error)}).`
    );
  }
  const ids = names
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .filter((id) => revisionIdPattern.test(id));
  const revisions = await Promise.all(
    ids.map((revisionId) => readSnapshotFile(folder, { revisionId, sourceKey }))
  );
  return revisions.sort((a, b) =>
    b.summary.capturedAt.localeCompare(a.summary.capturedAt)
  );
}
