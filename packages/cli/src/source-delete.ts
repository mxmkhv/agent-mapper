import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readlink, realpath } from "node:fs/promises";
import { basename, dirname, sep } from "node:path";
import type {
  InventoryEntry,
  SourceDeleteApply,
  SourceDeletePlan,
  SourceDeleteResult,
  SourceRef
} from "@agent-mapper/core";
import { readSkillFolder } from "./skill-folder";
import { documentError, errnoCode, ioError } from "./source-document-errors";
import type { SourceDocumentRegistry } from "./source-document-registry";

/** Moves paths to the user's Trash, where Finder's Put Back can restore them. */
export type MoveToTrash = (path: string) => Promise<void>;

/** macOS 15 and later ship `/usr/bin/trash`. */
function systemTrash(path: string): Promise<void> {
  return new Promise((finish, reject) => {
    const child = spawn("/usr/bin/trash", [path], { stdio: "ignore" });
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
    child.once("exit", (code) =>
      code === 0
        ? finish()
        : reject(
            documentError(
              "io_error",
              `The Trash refused ${path} (trash exited with status ${code}). Delete it in Finder instead.`
            )
          )
    );
  });
}

const inside = (path: string, root: string) =>
  path === root || path.startsWith(`${root}${sep}`);

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

async function realOrSelf(path: string): Promise<string> {
  return realpath(path).catch(() => path);
}

async function linkTarget(path: string) {
  return {
    path,
    target: "link" as const,
    linkTarget: await realOrSelf(path),
    files: 1,
    totalBytes: 0,
    fingerprint: sha(`link:${await readlink(path)}`)
  };
}

/** A skill is its folder; an agent is its file. Either may be a link, which goes alone. */
async function targetOf(entry: InventoryEntry) {
  const path = entry.kind === "skill" ? dirname(entry.path) : entry.path;
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
  if (entry.kind === "skill") {
    const folder = await readSkillFolder(path);
    const files = folder.items.filter((item) => item.type !== "directory");
    return {
      path,
      target: "folder" as const,
      files: files.length,
      totalBytes: folder.totalBytes,
      fingerprint: sha(
        JSON.stringify(
          folder.items.map(({ path, type, bytes }) => [path, type, bytes])
        )
      )
    };
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
      entry.declarationOnly ||
      (entry.kind === "skill" && basename(entry.path) !== "SKILL.md")
    ) {
      throw documentError(
        "invalid_request",
        "Only skill folders with a SKILL.md and agent files can be deleted."
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
