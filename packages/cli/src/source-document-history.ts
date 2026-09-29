import { randomBytes } from "node:crypto";
import { open, readFile, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { RevisionSummary } from "@agent-mapper/core";
import { hashBytes, type DocumentFormat } from "./source-document-bytes";
import { documentError, errnoCode } from "./source-document-errors";

const privateFile = 0o600;
const revisionIdBytes = 12;
const revisionIdPattern = /^[a-f0-9]{24}$/;
const snapshotFormat = 1;

export interface StoredRevision {
  summary: Omit<RevisionSummary, "current">;
  bytes: Buffer;
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
    bytes
  };
}

async function readSnapshotFile(
  folder: string,
  input: { revisionId: string; sourceKey: string }
): Promise<StoredRevision> {
  const path = join(folder, `${input.revisionId}.json`);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      throw documentError(
        "not_found",
        "That saved version is not in this file's history."
      );
    }
    throw documentError(
      "history_unavailable",
      `Could not read history snapshot ${path} (${errnoCode(error) ?? String(error)}). Check its permissions, then try again.`
    );
  }
  let revision: StoredRevision | undefined;
  try {
    revision = parseSnapshot(text, input.sourceKey);
  } catch {
    // JSON.parse reports a damaged snapshot only by throwing; it is reported just below.
    revision = undefined;
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

/** Newest first. A damaged snapshot is reported in `problems` without hiding the others. */
export async function listSnapshots(
  folder: string,
  sourceKey: string
): Promise<{ revisions: StoredRevision[]; problems: string[] }> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return { revisions: [], problems: [] };
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
  const results = await Promise.allSettled(
    ids.map((revisionId) => readSnapshotFile(folder, { revisionId, sourceKey }))
  );
  const revisions = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const problems = results.flatMap((result) =>
    result.status === "rejected"
      ? [
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        ]
      : []
  );
  revisions.sort((a, b) =>
    b.summary.capturedAt.localeCompare(a.summary.capturedAt)
  );
  return { revisions, problems };
}
