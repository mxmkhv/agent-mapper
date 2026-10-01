import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  rename,
  rm,
  rmdir,
  symlink
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathExists, readSkillFolder, type SkillFolder } from "./skill-folder";
import {
  DocumentApiError,
  documentError,
  errnoCode,
  ioError
} from "./source-document-errors";

const tokenBytes = 8;

async function writeItems(folder: SkillFolder, target: string): Promise<void> {
  await mkdir(target);
  for (const item of folder.items) {
    const destination = join(target, ...item.path.split("/"));
    if (item.special) {
      // Planning blocks folders with special files; this keeps a copy from ever reading one.
      throw documentError(
        "invalid_request",
        `${item.path} is not a regular file, folder or link, so it cannot be copied.`
      );
    }
    if (item.type === "directory") {
      await mkdir(destination);
    } else if (item.type === "symlink" && item.link !== undefined) {
      await symlink(item.link, destination);
    } else {
      await copyFile(item.absolutePath, destination, constants.COPYFILE_EXCL);
      await chmod(destination, item.mode);
    }
  }
  // Folder modes go last, deepest first, so a read-only folder does not block its own contents.
  const directories = folder.items.filter((item) => item.type === "directory");
  for (const item of directories.reverse()) {
    await chmod(join(target, ...item.path.split("/")), item.mode);
  }
  await chmod(target, folder.rootMode);
}

const reasonOf = (error: unknown) =>
  errnoCode(error) ?? (error instanceof Error ? error.message : String(error));

/**
 * Removes the folders `mkdir -p` made for a destination, deepest first, stopping at any that is
 * not empty. Returns a problem to report instead of throwing, so it cannot hide the original failure.
 */
export async function removeMadeFolders(
  deepest: string,
  madeFrom: string | undefined
): Promise<string> {
  if (!madeFrom) {
    return "";
  }
  let folder = deepest;
  try {
    for (;;) {
      await rmdir(folder);
      if (folder === madeFrom) {
        return "";
      }
      folder = dirname(folder);
    }
  } catch (error) {
    return errnoCode(error) === "ENOTEMPTY"
      ? ""
      : ` The empty folder ${folder} could not be removed (${reasonOf(error)}).`;
  }
}

/**
 * Copies into a hidden sibling of `destination`, checks the copy against the reviewed fingerprint,
 * then renames it into place. A failure removes the partial copy and any folders made for it.
 * Returns the first folder created on the way to `destination`, if any.
 */
export async function placeSkillFolder(
  folder: SkillFolder,
  input: { destination: string; fingerprint: string }
): Promise<{ madeFrom?: string }> {
  const { destination } = input;
  const parent = dirname(destination);
  const suffix = randomBytes(tokenBytes).toString("hex");
  const temporary = join(
    parent,
    `.${basename(destination)}.agent-mapper-${suffix}.tmp`
  );
  let madeFrom: string | undefined;
  try {
    madeFrom = await mkdir(parent, { recursive: true });
    await writeItems(folder, temporary);
    const copied = await readSkillFolder(temporary);
    if (copied.fingerprint !== input.fingerprint) {
      throw documentError(
        "conflict",
        `The skill changed while it was being copied to ${destination}. Nothing was kept; review the new preview and try again.`
      );
    }
    if (await pathExists(destination)) {
      throw documentError(
        "conflict",
        `${destination} appeared while copying. Nothing was replaced; review the new preview.`
      );
    }
    await rename(temporary, destination);
    return { madeFrom };
  } catch (error) {
    const leftover = await rm(temporary, { recursive: true, force: true }).then(
      () => removeMadeFolders(parent, madeFrom),
      (cleanup: unknown) =>
        ` A temporary folder may remain at ${temporary} (${reasonOf(cleanup)}); delete it by hand.`
    );
    const failure =
      error instanceof DocumentApiError
        ? error
        : ioError(error, `Copying the skill to ${destination}`);
    failure.message += leftover;
    throw failure;
  }
}
