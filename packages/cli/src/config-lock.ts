import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { errnoCode } from "./source-document-errors";

const lockMode = 0o600;
const retryMs = 25;
const waitMs = 2000;
// A config update takes milliseconds; a lock this old was left by a process that died mid-update.
const staleMs = 10_000;

function unwritable(path: string, error: unknown): Error {
  return new Error(
    `Could not save ${path} (${errnoCode(error) ?? String(error)}). Check that the folder is writable, then try again.`,
    { cause: error }
  );
}

async function removeIfStale(lock: string): Promise<void> {
  try {
    const { mtimeMs } = await stat(lock);
    if (Date.now() - mtimeMs > staleMs) {
      await rm(lock, { force: true });
    }
  } catch (error) {
    // Released between the failed create and this check: the next attempt can take it.
    if (errnoCode(error) !== "ENOENT") {
      throw error;
    }
  }
}

async function acquire(lock: string): Promise<void> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const handle = await open(lock, "wx", lockMode);
      await handle.writeFile(`pid ${process.pid}\n`);
      await handle.close();
      return;
    } catch (error) {
      if (errnoCode(error) !== "EEXIST") {
        throw error;
      }
    }
    await removeIfStale(lock);
    if (Date.now() > deadline) {
      throw new Error(
        `Another agent-mapper process is updating its settings (${lock} exists). Try again; if no other agent-mapper is running, delete that file.`
      );
    }
    await sleep(retryMs);
  }
}

/**
 * Runs a read-modify-write of `path` while holding `<path>.lock`, so agent-mapper processes sharing one
 * config file cannot overwrite each other's changes. Waits briefly for another holder.
 */
export async function withFileLock<T>(
  path: string,
  update: () => Promise<T>
): Promise<T> {
  const lock = `${path}.lock`;
  try {
    await mkdir(dirname(path), { recursive: true });
  } catch (error) {
    throw unwritable(path, error);
  }
  await acquire(lock).catch((error: unknown) => {
    throw errnoCode(error) ? unwritable(path, error) : error;
  });
  try {
    return await update();
  } finally {
    await rm(lock, { force: true });
  }
}
