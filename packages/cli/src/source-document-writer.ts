import { randomBytes } from "node:crypto";
import { open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  MutationResult,
  RevisionSummary,
  SourceDocument
} from "@agent-mapper/core";
import {
  DocumentApiError,
  documentError,
  errnoCode,
  ioError
} from "./source-document-errors";
import { historyFolder, writeSnapshot } from "./source-document-history";
import {
  canonicalTarget,
  readTarget,
  type TargetState
} from "./source-document-reader";

const permissionBits = 0o7777;
const lockFile = 0o600;
const tokenBytes = 8;

interface BoundTarget {
  sourceKey: string;
  entryPath: string;
  target: TargetState;
}

export interface MutationContext {
  bound: BoundTarget;
  historyRoot: string;
  /** Targets this server is writing right now, shared by every alias of a file. */
  busy: Set<string>;
  describe(target: TargetState): Promise<SourceDocument>;
}

export interface MutationPlan {
  expectedVersion: string;
  kind: RevisionSummary["kind"];
  proposed(current: TargetState): Buffer;
  /** Throws when the proposed bytes may not be written. Runs after the unchanged check. */
  check?(proposed: Buffer): void;
}

interface HeldLock {
  path: string;
  token: string;
}

async function acquireLock(
  context: MutationContext,
  folder: string
): Promise<HeldLock> {
  const { sourceKey } = context.bound;
  if (context.busy.has(sourceKey)) {
    throw documentError(
      "busy",
      "Another save or restore of this file is in progress. Wait for it to finish, then try again."
    );
  }
  const path = join(folder, "lock");
  const token = randomBytes(tokenBytes).toString("hex");
  try {
    const handle = await open(path, "wx", lockFile);
    try {
      await handle.writeFile(
        `pid ${process.pid}\ncreated ${new Date().toISOString()}\ntoken ${token}\n`
      );
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (errnoCode(error) === "EEXIST") {
      throw documentError(
        "busy",
        `Another agent-mapper process holds the write lock ${path}. If no other agent-mapper is running, stop all agent-mapper servers, delete that file, and try again.`
      );
    }
    throw ioError(error, `Creating the write lock ${path}`);
  }
  context.busy.add(sourceKey);
  return { path, token };
}

async function releaseLock(
  context: MutationContext,
  lock: HeldLock
): Promise<void> {
  context.busy.delete(context.bound.sourceKey);
  const content = await readFile(lock.path, "utf8").catch((error: unknown) => {
    // Someone already removed the lock by hand; there is nothing left to release.
    if (errnoCode(error) === "ENOENT") {
      return "";
    }
    throw error;
  });
  // Only remove the lock this operation created.
  if (content.includes(`token ${lock.token}\n`)) {
    await rm(lock.path);
  }
}

async function writeTemporary(
  current: TargetState,
  bytes: Buffer
): Promise<string> {
  const { canonicalPath } = current;
  const suffix = randomBytes(tokenBytes).toString("hex");
  const temporary = join(
    dirname(canonicalPath),
    `.${basename(canonicalPath)}.agent-mapper-${suffix}.tmp`
  );
  const mode = current.stats.mode & permissionBits;
  const handle = await open(temporary, "wx", mode);
  try {
    await handle.writeFile(bytes);
    // open() applies the umask; set the original mode explicitly.
    await handle.chmod(mode);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return temporary;
}

async function assertUnchanged(
  current: TargetState,
  entryPath: string
): Promise<void> {
  const [target, now] = await Promise.all([
    canonicalTarget(entryPath),
    readTarget(current.canonicalPath)
  ]);
  if (target !== current.canonicalPath || now.version !== current.version) {
    throw documentError(
      "conflict",
      "The file changed on disk while saving. Nothing was written; reopen it to compare."
    );
  }
}

/** Writes a sibling of the real target, then renames it over the target. Symlinks stay links. */
async function replaceTarget(
  bound: BoundTarget,
  input: { current: TargetState; bytes: Buffer }
): Promise<void> {
  const { current } = input;
  let temporary: string | undefined;
  try {
    temporary = await writeTemporary(current, input.bytes);
    await assertUnchanged(current, bound.entryPath);
    await rename(temporary, current.canonicalPath);
  } catch (error) {
    const leftover = temporary
      ? await rm(temporary, { force: true }).then(
          () => "",
          () => ` A temporary file may remain at ${temporary}.`
        )
      : "";
    const failure =
      error instanceof DocumentApiError
        ? error
        : ioError(error, `Saving ${current.canonicalPath}`);
    failure.message += leftover;
    throw failure;
  }
}

async function readBack(
  context: MutationContext,
  result: MutationResult
): Promise<MutationResult> {
  try {
    const target = await readTarget(context.bound.target.canonicalPath);
    return { ...result, document: await context.describe(target) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...result,
      warnings: [
        `Saved, but reading the file back failed: ${reason} Reopen the source before editing again.`
      ]
    };
  }
}

async function commitLocked(
  context: MutationContext,
  input: { plan: MutationPlan; folder: string }
): Promise<MutationResult> {
  const { bound } = context;
  const { plan } = input;
  const current = await readTarget(bound.target.canonicalPath);
  const proposed = plan.proposed(current);
  // Equality comes before the version check so a retry of an already-applied save reconciles.
  if (proposed.equals(current.bytes)) {
    return {
      sourceKey: bound.sourceKey,
      outcome: "unchanged",
      document: await context.describe(current)
    };
  }
  if (current.version !== plan.expectedVersion) {
    throw documentError(
      "conflict",
      "The file changed on disk since you opened it. Nothing was written; reopen it to compare."
    );
  }
  plan.check?.(proposed);
  const revisionId = await writeSnapshot(input.folder, {
    kind: plan.kind,
    sourceKey: bound.sourceKey,
    canonicalPath: current.canonicalPath,
    bytes: current.bytes,
    format: current.decoded
  });
  await replaceTarget(bound, { current, bytes: proposed });
  return readBack(context, {
    sourceKey: bound.sourceKey,
    outcome: "saved",
    revisionId
  });
}

/** Save and restore share one sequence: lock, equality, version, snapshot, replace, read back. */
export async function commitMutation(
  context: MutationContext,
  plan: MutationPlan
): Promise<MutationResult> {
  const folder = await historyFolder(
    context.historyRoot,
    context.bound.sourceKey
  );
  const lock = await acquireLock(context, folder);
  try {
    return await commitLocked(context, { plan, folder });
  } finally {
    await releaseLock(context, lock);
  }
}
