import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { SkillTransferFile } from "@agent-mapper/core";
import { errnoCode, ioError } from "./source-document-errors";

/** A skill is a few documents and scripts; anything larger is likely a checkout or build output. */
const maxItems = 1000;
const maxBytes = 52_428_800;
const permissionBits = 0o7777;
const executableBits = 0o111;

interface FolderItem extends SkillTransferFile {
  absolutePath: string;
  mode: number;
  /** The link text of a symlink, recreated verbatim. */
  link?: string;
}

export interface SkillFolder {
  root: string;
  rootMode: number;
  items: FolderItem[];
  totalBytes: number;
  /** Covers every path, type, executable bit, file content and link text. */
  fingerprint: string;
  /** Why this folder cannot be transferred as it is. */
  problem?: string;
}

const posixPath = (path: string) => path.split(sep).join("/");

/** A relative link that stays inside the skill folder still works after the folder moves. */
function linkProblem(item: { path: string; link: string }): string | undefined {
  if (isAbsolute(item.link)) {
    return `${item.path} links to the absolute path ${item.link}. Make the link relative to the skill folder or replace it with the file.`;
  }
  const target = join(dirname(item.path), item.link);
  if (target === ".." || target.startsWith(`..${sep}`)) {
    return `${item.path} links outside the skill folder (${item.link}), so the copy would break it. Replace the link with the file.`;
  }
  return undefined;
}

async function readItem(
  root: string,
  absolutePath: string
): Promise<{ item: FolderItem; problem?: string }> {
  const info = await lstat(absolutePath);
  const path = posixPath(relative(root, absolutePath));
  const base = {
    absolutePath,
    path,
    mode: info.mode & permissionBits,
    executable: (info.mode & executableBits) !== 0
  };
  if (info.isSymbolicLink()) {
    const link = await readlink(absolutePath);
    return {
      item: { ...base, type: "symlink", bytes: 0, link },
      problem: linkProblem({ path, link })
    };
  }
  if (info.isDirectory()) {
    return { item: { ...base, type: "directory", bytes: 0 } };
  }
  if (!info.isFile()) {
    return {
      item: { ...base, type: "file", bytes: 0 },
      problem: `${path} is not a regular file, folder or link, so it cannot be copied.`
    };
  }
  return { item: { ...base, type: "file", bytes: info.size } };
}

async function fingerprintOf(items: readonly FolderItem[]): Promise<string> {
  const hash = createHash("sha256");
  for (const item of items) {
    hash.update(`${item.type}\0${item.path}\0${item.executable}\0`);
    if (item.type === "file") {
      hash.update(await readFile(item.absolutePath));
    } else if (item.link !== undefined) {
      hash.update(item.link);
    }
    hash.update("\n");
  }
  return hash.digest("hex");
}

/** Lists a skill folder without following links, parents before children, siblings sorted by name. */
export async function readSkillFolder(root: string): Promise<SkillFolder> {
  const items: FolderItem[] = [];
  const problems: string[] = [];
  let totalBytes = 0;
  const walk = async (directory: string): Promise<void> => {
    const names = (await readdir(directory)).sort();
    for (const name of names) {
      if (items.length >= maxItems) {
        return;
      }
      const read = await readItem(root, join(directory, name));
      items.push(read.item);
      totalBytes += read.item.bytes;
      if (read.problem) {
        problems.push(read.problem);
      }
      if (read.item.type === "directory") {
        await walk(read.item.absolutePath);
      }
    }
  };
  let rootMode;
  let fingerprint = "";
  try {
    rootMode = (await lstat(root)).mode & permissionBits;
    await walk(root);
    if (items.length >= maxItems) {
      problems.unshift(
        `${root} holds more than ${maxItems} files and folders. Skills this large are not copied here; use Finder or the shell.`
      );
    } else if (totalBytes > maxBytes) {
      problems.unshift(
        `${root} holds more than 50 MiB. Skills this large are not copied here; use Finder or the shell.`
      );
    }
    if (!problems.length) {
      fingerprint = await fingerprintOf(items);
    }
  } catch (error) {
    throw ioError(error, `Reading the skill folder ${root}`);
  }
  return {
    root,
    rootMode,
    items,
    totalBytes,
    fingerprint,
    problem: problems[0]
  };
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return false;
    }
    throw error;
  }
}
