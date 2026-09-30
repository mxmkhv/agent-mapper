import { readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import type {
  InventoryEntry,
  SkillTransferDestination,
  SkillTransferPlan,
  SkillTransferRequest,
  ToolId
} from "@agent-mapper/core";
import { pathExists, readSkillFolder, type SkillFolder } from "./skill-folder";
import { skillPortability } from "./skill-portability";
import { documentError, ioError } from "./source-document-errors";
import type { SourceDocumentRegistry } from "./source-document-registry";
import {
  distinctFolders,
  inside,
  realOrSelf,
  resolvedPath
} from "./skill-transfer-paths";

export interface TransferSetup {
  registry: SourceDocumentRegistry;
  roots(): { home: string; claude: string };
  /** Project folders the user can see: discovered or scanned. */
  knownProjects(): Iterable<string>;
}

export interface TransferSource {
  entry: InventoryEntry;
  /** The skill folder as the inventory lists it. */
  entryFolder: string;
  /** The folder whose contents are copied, with links resolved. */
  sourceFolder: string;
  readOnlyRoots: string[];
}

async function transferSource(
  registry: SourceDocumentRegistry,
  request: SkillTransferRequest
): Promise<TransferSource> {
  const found = registry.lookup(request.source);
  if (!found) {
    throw documentError(
      "unknown_source",
      "This skill is not in the latest scan. Rescan and try again."
    );
  }
  const { entry } = found.item;
  if (
    entry.kind !== "skill" ||
    entry.declarationOnly ||
    entry.inlineContent ||
    basename(entry.path) !== "SKILL.md"
  ) {
    throw documentError(
      "invalid_request",
      "Only skill folders with a SKILL.md can be copied or moved."
    );
  }
  const entryFolder = dirname(entry.path);
  const exists = await pathExists(entryFolder).catch((error: unknown) => {
    throw ioError(error, `Checking ${entryFolder}`);
  });
  if (!exists) {
    throw documentError(
      "unknown_source",
      `${entryFolder} is gone since the last scan. Rescan and try again.`
    );
  }
  return {
    entry,
    entryFolder,
    sourceFolder: await realOrSelf(entryFolder),
    readOnlyRoots: found.readOnlyRoots
  };
}

function destinationFolders(
  setup: TransferSetup,
  input: { request: SkillTransferRequest; name: string }
): { tool: ToolId; path: string }[] {
  const { request, name } = input;
  const tools = [...new Set(request.tools)];
  if (request.mode === "promote") {
    const roots = setup.roots();
    const global: Record<ToolId, string> = {
      claude: join(roots.claude, "skills"),
      codex: join(roots.home, ".agents", "skills")
    };
    return tools.map((tool) => ({ tool, path: join(global[tool], name) }));
  }
  const project = request.projectPath ?? "";
  if (!isAbsolute(project) || ![...setup.knownProjects()].includes(project)) {
    throw documentError(
      "invalid_request",
      "Choose a project from the sidebar to copy into."
    );
  }
  const local: Record<ToolId, string> = {
    claude: join(project, ".claude", "skills"),
    codex: join(project, ".agents", "skills")
  };
  return tools.map((tool) => ({ tool, path: join(local[tool], name) }));
}

async function withConflict(
  destination: { tool: ToolId; path: string },
  input: { source: TransferSource; fingerprint: string }
): Promise<SkillTransferDestination> {
  const { source } = input;
  const real = await resolvedPath(destination.path);
  if (destination.path === source.entryFolder || real === source.sourceFolder) {
    return { ...destination, conflict: "This is where the skill already is." };
  }
  const exists = await pathExists(destination.path).catch((error: unknown) => {
    throw ioError(error, `Checking ${destination.path}`);
  });
  if (!exists) {
    return destination;
  }
  // An unreadable folder in the way is still in the way; only the "identical" wording needs the read.
  const existing = await readSkillFolder(destination.path).catch(
    () => undefined
  );
  return {
    ...destination,
    conflict:
      existing?.fingerprint && existing.fingerprint === input.fingerprint
        ? "An identical copy is already here."
        : `${destination.path} already exists. Rename or remove it first; nothing is overwritten.`
  };
}

async function blockedReason(
  request: SkillTransferRequest,
  source: TransferSource
): Promise<string | undefined> {
  if (!request.tools.length) {
    return "Choose Claude Code, Codex, or both.";
  }
  if (request.mode === "copy") {
    return undefined;
  }
  const { entry } = source;
  if (entry.pluginId || entry.scope !== "project") {
    return "Only a project's own skills can be moved to global. Copy this one instead.";
  }
  // Resolve through the project, not the parent: a linked `.claude` or `skills` folder may be shared.
  const project = entry.projectPath;
  const expected = project
    ? join(await realOrSelf(project), relative(project, source.entryFolder))
    : undefined;
  if (source.sourceFolder !== expected) {
    return `${source.entryFolder} leads to ${source.sourceFolder} through a link, so moving it would delete a folder other projects may share. Move the linked folder instead.`;
  }
  const roots = await Promise.all(source.readOnlyRoots.map(realOrSelf));
  if (roots.some((root) => inside(source.sourceFolder, root))) {
    return "This skill lives in a plugin or managed folder, which stays read-only.";
  }
  return undefined;
}

async function warnings(
  setup: TransferSetup,
  input: {
    request: SkillTransferRequest;
    source: TransferSource;
    destinations: SkillTransferDestination[];
  }
): Promise<string[]> {
  const { request, source } = input;
  const content = await readFile(source.entry.path, "utf8").catch(
    (error: unknown) => {
      throw ioError(error, `Reading ${source.entry.path}`);
    }
  );
  const warnings = skillPortability({
    content,
    from: source.entry.tool,
    to: input.destinations.map((item) => item.tool),
    hasCodexMetadata: await pathExists(
      join(source.sourceFolder, "agents", "openai.yaml")
    )
  });
  if (request.mode === "promote") {
    const aliases = setup.registry
      .impact(join(source.sourceFolder, "SKILL.md"))
      .aliases.filter((path) => path !== source.entry.path);
    for (const alias of aliases) {
      warnings.push(
        `${alias} also leads to this skill and will break when it moves.`
      );
    }
  }
  return warnings;
}

/** What a transfer would write, and why it cannot, read fresh from disk. */
export async function planTransfer(
  setup: TransferSetup,
  request: SkillTransferRequest
): Promise<{
  plan: SkillTransferPlan;
  source: TransferSource;
  folder: SkillFolder;
}> {
  const source = await transferSource(setup.registry, request);
  const folder = await readSkillFolder(source.sourceFolder);
  const name = basename(source.entryFolder);
  const folders = await distinctFolders(
    destinationFolders(setup, { request, name })
  );
  const destinations = await Promise.all(
    folders.unique.map((destination) =>
      withConflict(destination, { source, fingerprint: folder.fingerprint })
    )
  );
  const plan: SkillTransferPlan = {
    mode: request.mode,
    name,
    sourceFolder: source.sourceFolder,
    fingerprint: folder.fingerprint,
    files: folder.items.map(({ path, type, bytes, executable }) => ({
      path,
      type,
      bytes,
      executable
    })),
    totalBytes: folder.totalBytes,
    destinations,
    warnings: [
      ...folders.notes,
      ...(await warnings(setup, { request, source, destinations }))
    ],
    blocked: (await blockedReason(request, source)) ?? folder.problem
  };
  return { plan, source, folder };
}
