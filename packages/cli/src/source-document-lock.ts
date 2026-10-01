import { randomBytes } from "node:crypto";
import { open, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { documentError, errnoCode, ioError } from "./source-document-errors";

const lockFile = 0o600;
const tokenBytes = 8;

export interface HeldLock {
  path: string;
  token: string;
  sourceKey: string;
}

async function createLockFile(path: string, token: string): Promise<void> {
  const handle = await open(path, "wx", lockFile);
  try {
    await handle.writeFile(
      `pid ${process.pid}\ncreated ${new Date().toISOString()}\ntoken ${token}\n`
    );
  } catch (error) {
    await handle.close();
    // A half-written lock would block every later save; it is ours, so remove it.
    await rm(path, { force: true });
    throw error;
  }
  await handle.close();
}

/**
 * Two layers: an in-server set, claimed before any await so concurrent requests cannot both pass,
 * and an exclusive lock file shared with other agent-mapper processes. Neither is ever taken over.
 */
export async function acquireLock(
  busy: Set<string>,
  target: { folder: string; sourceKey: string }
): Promise<HeldLock> {
  const { sourceKey } = target;
  if (busy.has(sourceKey)) {
    throw documentError(
      "busy",
      "Another save or restore of this file is in progress. Wait for it to finish, then try again."
    );
  }
  busy.add(sourceKey);
  const path = join(target.folder, "lock");
  const token = randomBytes(tokenBytes).toString("hex");
  try {
    await createLockFile(path, token);
  } catch (error) {
    busy.delete(sourceKey);
    if (errnoCode(error) === "EEXIST") {
      throw documentError(
        "busy",
        `The write lock ${path} exists. Another agent-mapper process may be saving this file; the lock records its pid. If none is, an interrupted save left it: delete the lock and save again. This session and its drafts can stay open.`
      );
    }
    throw ioError(error, `Creating the write lock ${path}`);
  }
  return { path, token, sourceKey };
}

/** Releases only the lock this operation created. Returns a problem to report instead of throwing, so it cannot hide the save's own result. */
export async function releaseLock(
  busy: Set<string>,
  lock: HeldLock
): Promise<string | undefined> {
  busy.delete(lock.sourceKey);
  try {
    const content = await readFile(lock.path, "utf8");
    if (content.includes(`token ${lock.token}\n`)) {
      await rm(lock.path);
    }
    return undefined;
  } catch (error) {
    // Already removed by hand: nothing is left to release.
    if (errnoCode(error) === "ENOENT") {
      return undefined;
    }
    return `The write lock ${lock.path} could not be removed (${errnoCode(error) ?? String(error)}). Delete it before the next save.`;
  }
}
