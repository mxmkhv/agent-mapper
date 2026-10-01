import { expectedEntry } from "./entry-estimate";
import type {
  InventoryEntry,
  ResolutionContext,
  ResolvedEntry
} from "./inventory";

function containsPath(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent.replace(/\/$/, "")}/`);
}

function entryApplies(
  entry: InventoryEntry,
  workingDirectory: string
): boolean {
  if (entry.scope === "global" || entry.scope === "managed") {
    return true;
  }
  if (entry.scope === "unknown") {
    return false;
  }
  const root =
    entry.projectPath ?? entry.path.slice(0, entry.path.lastIndexOf("/"));
  return containsPath(root, workingDirectory);
}

function winningOverride(
  entry: InventoryEntry,
  entries: readonly InventoryEntry[]
): InventoryEntry | undefined {
  if (
    entry.tool !== "codex" ||
    entry.kind !== "instruction" ||
    entry.name !== "AGENTS.md"
  ) {
    return undefined;
  }
  const overridePath = `${entry.path.slice(0, entry.path.lastIndexOf("/"))}/AGENTS.override.md`;
  return entries.find(
    (candidate) =>
      candidate.tool === "codex" &&
      candidate.path === overridePath &&
      candidate.readState === "readable" &&
      (candidate.characters ?? 0) > 0
  );
}

// Claude Code 2.1.285 reads AGENTS.md only as a fallback for the whole folder
// chain: one project CLAUDE.md or CLAUDE.local.md anywhere from the working
// directory up to / (or in a .claude folder along the way) drops every AGENTS.md in the chain.
// The user file (~/.claude/CLAUDE.md) does not count.
function winningClaudeFile({
  entry,
  entries,
  context
}: ResolveInput): InventoryEntry | undefined {
  if (
    entry.tool !== "claude" ||
    entry.kind !== "instruction" ||
    entry.name !== "AGENTS.md"
  ) {
    return undefined;
  }
  return entries.find(
    (candidate) =>
      candidate.tool === "claude" &&
      candidate.scope === "project" &&
      (candidate.name === "CLAUDE.md" ||
        candidate.name === "CLAUDE.local.md") &&
      candidate.readState === "readable" &&
      (candidate.characters ?? 0) > 0 &&
      containsPath(claudeFileFolder(candidate.path), context.workingDirectory)
  );
}

function claudeFileFolder(path: string): string {
  const directory = path.slice(0, path.lastIndexOf("/"));
  return directory.endsWith("/.claude")
    ? directory.slice(0, -"/.claude".length)
    : directory;
}

interface ResolveInput {
  entry: InventoryEntry;
  entries: readonly InventoryEntry[];
  context: ResolutionContext;
}

function resolveEntry({
  entry,
  entries,
  context
}: ResolveInput): ResolvedEntry {
  const unavailable = unavailableEntry(entry, context);
  if (unavailable) {
    return unavailable;
  }
  const override = winningOverride(entry, entries);
  if (override) {
    return {
      entry,
      resolution: {
        availability: "shadowed",
        loading: "not-applicable",
        reason: `AGENTS.override.md wins in this folder: ${override.path}`
      }
    };
  }
  const claudeFile = winningClaudeFile({ entry, entries, context });
  if (claudeFile) {
    return {
      entry,
      resolution: {
        availability: "shadowed",
        loading: "not-applicable",
        reason: `Claude Code skips AGENTS.md because this folder chain has ${claudeFile.path}`
      }
    };
  }
  return expectedEntry(entry);
}

function unresolved(
  entry: InventoryEntry,
  input: { availability: "not-applicable" | "unknown"; reason: string }
): ResolvedEntry {
  return {
    entry,
    resolution: {
      availability: input.availability,
      loading: input.availability,
      reason: input.reason
    }
  };
}

function unavailableEntry(
  entry: InventoryEntry,
  context: ResolutionContext
): ResolvedEntry | undefined {
  if (!entryApplies(entry, context.workingDirectory)) {
    return unresolved(entry, {
      availability: "not-applicable",
      reason: "Source is outside the selected folder's configuration path."
    });
  }
  if (entry.readState !== "readable") {
    return unresolved(entry, {
      availability: "unknown",
      reason: `Source is ${entry.readState}; loading cannot be determined.`
    });
  }
  // A readable skill carries an error only when its frontmatter is malformed, which a tool may refuse to load.
  if (entry.kind === "skill" && entry.error) {
    return unresolved(entry, {
      availability: "unknown",
      reason: `Frontmatter problem: ${entry.error} Whether the skill loads cannot be determined.`
    });
  }
  if (
    entry.tool === "codex" &&
    entry.kind === "instruction" &&
    entry.characters === 0
  ) {
    return unresolved(entry, {
      availability: "not-applicable",
      reason: "Codex skips empty instruction files."
    });
  }
  return undefined;
}

export function resolveInventory(
  entries: readonly InventoryEntry[],
  context: ResolutionContext
): ResolvedEntry[] {
  return entries
    .filter((entry) => entry.tool === context.tool)
    .map((entry) => resolveEntry({ entry, entries, context }));
}
