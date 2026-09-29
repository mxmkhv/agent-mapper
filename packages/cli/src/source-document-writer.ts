import { randomBytes } from "node:crypto";
import { open, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  MutationResult,
  RevisionSummary,
  SourceDocument
} from "@agent-mapper/core";
import { maxDocumentBytes } from "./source-document-bytes";
import {
  DocumentApiError,
  documentError,
  ioError
} from "./source-document-errors";
import { writeSnapshot } from "./source-document-history";
import { historyFolder } from "./source-document-history-folder";
import { acquireLock, releaseLock } from "./source-document-lock";
import {
  canonicalTarget,
  readTarget,
  type TargetState
} from "./source-document-reader";

const permissionBits = 0o7777;
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
  } catch (error) {
    await handle.close();
    // Never leave a partial copy of the draft next to the user's file.
    const leftover = await rm(temporary, { force: true }).then(
      () => "",
      () => ` A temporary file may remain at ${temporary}.`
    );
    const failure = ioError(error, `Writing ${canonicalPath}`);
    failure.message += leftover;
    throw failure;
  }
  await handle.close();
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
        `The file was saved, but agent-mapper could not read it back right away: ${reason}`
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
  if (proposed.length > maxDocumentBytes) {
    throw documentError(
      "too_large",
      "With its line endings applied this document is larger than 1 MiB. Shorten it or edit it in another editor."
    );
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

/**
 * Save and restore share one sequence: history folder, lock, equality, size, version, validation,
 * snapshot, replace, read back. A lock that cannot be released never hides the result.
 */
export async function commitMutation(
  context: MutationContext,
  plan: MutationPlan
): Promise<MutationResult> {
  const { sourceKey } = context.bound;
  const folder = await historyFolder(context.historyRoot, sourceKey);
  const lock = await acquireLock(context.busy, { folder, sourceKey });
  let result: MutationResult;
  try {
    result = await commitLocked(context, { plan, folder });
  } catch (error) {
    const problem = await releaseLock(context.busy, lock);
    if (problem && error instanceof Error) {
      error.message += ` ${problem}`;
    }
    throw error;
  }
  const problem = await releaseLock(context.busy, lock);
  return problem
    ? { ...result, warnings: [...(result.warnings ?? []), problem] }
    : result;
}
