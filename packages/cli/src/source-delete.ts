import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import type {
  InventoryEntry,
  SourceDeleteApply,
  SourceDeletePlan,
  SourceDeleteResult,
  SourceRef
} from "@agent-mapper/core";
import {
  fingerprintOf,
  maxFolderItems,
  pathExists,
  readSkillFolder
} from "./skill-folder";
import { inside, realOrSelf } from "./skill-transfer-paths";
import { documentError, errnoCode, ioError } from "./source-document-errors";
import type { SourceDocumentRegistry } from "./source-document-registry";

/** Moves paths to the user's Trash, where Finder's Put Back can restore them. */
export type MoveToTrash = (path: string) => Promise<void>;

/** macOS 15 and later ship `/usr/bin/trash`. Its own explanation of a refusal is passed on. */
function systemTrash(path: string): Promise<void> {
  return new Promise((finish, reject) => {
    const child = spawn("/usr/bin/trash", [path], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) =>
      reject(
        errnoCode(error) === "ENOENT"
          ? documentError(
              "io_error",
              "Moving to the Trash needs macOS 15 or later. Delete the file in Finder instead."
            )
          : error
      )
    );
    child.once("close", (code, signal) =>
      code === 0
        ? finish()
        : reject(
            documentError(
              "io_error",
              `The Trash refused ${path} (${stderr.trim() || (signal ? `trash stopped by ${signal}` : `trash exited with status ${code}`)}). Delete it in Finder instead.`
            )
          )
    );
  });
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** A link goes alone. A broken one still names where it pointed, so the dialog can say the target is missing. */
async function linkTarget(path: string) {
  const text = await readlink(path).catch((error: unknown) => {
    throw ioError(error, `Reading the link ${path}`);
  });
  const pointsTo = resolve(dirname(path), text);
  const exists = await pathExists(pointsTo).catch((error: unknown) => {
    throw ioError(error, `Checking ${pointsTo}`);
  });
  return {
    path,
    target: "link" as const,
    linkTarget: exists ? await realOrSelf(path) : pointsTo,
    broken: !exists,
    files: 1,
    totalBytes: 0,
    fingerprint: sha(`link:${text}`)
  };
}

/** The folder that holds a SKILL.md entry; a skill link whose target is gone is listed at the link itself. */
const skillFile = (entry: InventoryEntry) =>
  entry.kind === "skill" && basename(entry.path) === "SKILL.md";

/**
 * The listing stops at a cap, so a larger folder cannot be checked for changes before it goes; it is reported
 * as too large and the delete is refused rather than trashing files nobody reviewed.
 */
async function folderTarget(path: string) {
  const folder = await readSkillFolder(path);
  const files = folder.items.filter((item) => item.type !== "directory");
  const tooLarge = folder.items.length >= maxFolderItems;
  return {
    path,
    target: "folder" as const,
    files: files.length,
    tooLarge,
    totalBytes: folder.totalBytes,
    // Content, not just names and sizes: a same-size edit after the dialog opened must stop the delete.
    // Too large to read is blocked anyway; the placeholder only keeps the request well-formed.
    fingerprint: tooLarge
      ? sha(`too-large:${path}`)
      : await fingerprintOf(folder.items).catch((error: unknown) => {
          throw ioError(error, `Reading the skill folder ${path}`);
        })
  };
}

/** A skill is its folder; an agent is its file. Either may be a link, which goes alone. */
async function targetOf(entry: InventoryEntry) {
  const path = skillFile(entry) ? dirname(entry.path) : entry.path;
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      throw documentError(
        "not_found",
        `${path} is gone since the last scan. Rescan to update the inventory.`
      );
    }
    throw ioError(error, `Checking ${path}`);
  }
  if (info.isSymbolicLink()) {
    return linkTarget(path);
  }
  if (entry.kind === "skill" && !skillFile(entry)) {
    throw documentError(
      "invalid_request",
      `${path} is neither a skill folder nor a link to one. Rescan to update the inventory.`
    );
  }
  if (entry.kind === "skill") {
    return folderTarget(path);
  }
  const content = await readFile(path).catch((error: unknown) => {
    throw ioError(error, `Reading ${path}`);
  });
  return {
    path,
    target: "file" as const,
    files: 1,
    totalBytes: content.length,
    fingerprint: sha(content.toString("base64"))
  };
}

type Target = Awaited<ReturnType<typeof targetOf>>;

async function blockedReason(
  entry: InventoryEntry,
  input: { target: Target; protectedRoots: string[] }
): Promise<string | undefined> {
  if (entry.pluginId) {
    return "Plugin files are managed by the plugin. Disable or uninstall the plugin instead.";
  }
  if (entry.scope !== "global" && entry.scope !== "project") {
    return "Only your own global and project files can be deleted here.";
  }
  if (input.target.target === "folder" && input.target.tooLarge) {
    return `${input.target.path} holds more than ${maxFolderItems} files and folders, too many to check before deleting. Delete it in Finder instead.`;
  }
  // A link is removed from its folder; anything else is removed where it really lives.
  const touched =
    input.target.target === "link"
      ? await realOrSelf(dirname(input.target.path))
      : await realOrSelf(input.target.path);
  const roots = await Promise.all(input.protectedRoots.map(realOrSelf));
  return roots.some((root) => inside(touched, root))
    ? "This lives in a plugin or managed folder, which stays read-only."
    : undefined;
}

function warnings(
  registry: SourceDocumentRegistry,
  input: { entry: InventoryEntry; target: Target; canonical: string }
): string[] {
  const { entry, target } = input;
  const result: string[] = [];
  if (target.target !== "link") {
    for (const alias of registry.impact(input.canonical).aliases) {
      if (alias !== entry.path) {
        result.push(`${alias} also leads here and will stop working.`);
      }
    }
  }
  if (entry.installedFrom) {
    result.push(
      `The skills installer's lock file still lists it as installed from ${entry.installedFrom.repo}.`
    );
  }
  return result;
}

/** Moves a skill folder or an agent file, or the link standing in for one, to the Trash. */
export class SourceDeleteService {
  constructor(
    private readonly options: {
      registry: SourceDocumentRegistry;
      trash?: MoveToTrash;
    }
  ) {}

  async plan(ref: SourceRef): Promise<SourceDeletePlan> {
    const { registry } = this.options;
    const found = registry.lookup(ref);
    if (!found) {
      throw documentError(
        "unknown_source",
        "This item is not in the latest scan. Rescan and try again."
      );
    }
    const { entry } = found.item;
    if (
      (entry.kind !== "skill" && entry.kind !== "agent") ||
      entry.inlineContent ||
      entry.declarationOnly
    ) {
      throw documentError(
        "invalid_request",
        "Only skill folders, skill links and agent files can be deleted."
      );
    }
    const target = await targetOf(entry);
    return {
      kind: entry.kind,
      name: entry.name,
      ...target,
      warnings: warnings(registry, {
        entry,
        target,
        canonical: await realOrSelf(entry.path)
      }),
      blocked: await blockedReason(entry, {
        target,
        protectedRoots: [...registry.protectedRoots(), ...found.readOnlyRoots]
      })
    };
  }

  async apply(request: SourceDeleteApply): Promise<SourceDeleteResult> {
    const plan = await this.plan(request.source);
    if (plan.blocked) {
      throw documentError("read_only", plan.blocked);
    }
    if (plan.fingerprint !== request.fingerprint) {
      throw documentError(
        "conflict",
        `${plan.path} changed since you opened this. Nothing was deleted; review it again.`
      );
    }
    await (this.options.trash ?? systemTrash)(plan.path);
    return { trashed: plan.path };
  }
}
