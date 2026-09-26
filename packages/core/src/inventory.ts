export type ToolId = "claude" | "codex";
type EntryKind = "instruction" | "skill";
type Scope = "global" | "project" | "unknown";
type ReadState = "readable" | "missing" | "unreadable";

export interface InventoryEntry {
  id: string;
  tool: ToolId;
  kind: EntryKind;
  name: string;
  description?: string;
  path: string;
  realPath?: string;
  projectPath?: string;
  scope: Scope;
  readState: ReadState;
  isSymlink: boolean;
  characters?: number;
  error?: string;
  preview?: string;
  pluginId?: string;
}

export type PluginState =
  "selected" | "disabled" | "cached" | "missing" | "unknown";
type PluginContributionKind = "skill" | "command" | "agent" | "hook" | "mcp";

export interface PluginContribution {
  kind: PluginContributionKind;
  name: string;
  sourcePath: string;
  entryId?: string;
}

export interface PluginRecord {
  id: string;
  tool: ToolId;
  key: string;
  name: string;
  marketplace?: string;
  version?: string;
  scope: Scope;
  state: PluginState;
  reason: string;
  installPath?: string;
  projectPath?: string;
  sourcePath: string;
  installationEvidence?: string;
  settingsEvidence?: string;
  issues?: string[];
  contributions: PluginContribution[];
}

export type HookLane =
  | "Session start"
  | "Prompt submit"
  | "Before tool"
  | "Permission"
  | "After tool"
  | "Subagent"
  | "Compact"
  | "Stop"
  | "Session end"
  | "Other";

export interface HookRecord {
  id: string;
  tool: ToolId;
  event: string;
  lane: HookLane;
  matcher?: string;
  handlerType: string;
  locator: string;
  sourcePath: string;
  scope: Scope;
  pluginId?: string;
  condition?: string;
  flags: string[];
  availability: "configured" | "disabled" | "conditional" | "unknown";
  reason: string;
}

export interface ResolutionContext {
  workingDirectory: string;
  tool: ToolId;
}

interface EntryResolution {
  availability: "expected" | "shadowed" | "not-applicable" | "unknown";
  loading: "startup" | "agent-selected" | "not-applicable" | "unknown";
  reason: string;
  estimatedTokens?: { startup: number; onDemand: number };
}

export interface ResolvedEntry {
  entry: InventoryEntry;
  resolution: EntryResolution;
}

export interface InventorySnapshot {
  workingDirectory: string;
  scannedAt: string;
  roots: { claude: string; codex: string };
  items: ResolvedEntry[];
  plugins: PluginRecord[];
  hooks: HookRecord[];
  coverage: string[];
}

const charactersPerToken = 4;

function containsPath(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent.replace(/\/$/, "")}/`);
}

function entryApplies(
  entry: InventoryEntry,
  workingDirectory: string
): boolean {
  if (entry.scope === "global") {
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
      entryApplies(candidate, context.workingDirectory)
  );
}

interface ResolveInput {
  entry: InventoryEntry;
  entries: readonly InventoryEntry[];
  context: ResolutionContext;
}

function expectedEntry(entry: InventoryEntry): ResolvedEntry {
  const skill = entry.kind === "skill";
  const estimate = Math.round((entry.characters ?? 0) / charactersPerToken);
  return {
    entry,
    resolution: {
      availability: "expected",
      loading: skill ? "agent-selected" : "startup",
      reason: skill
        ? "Skill is discoverable for this folder; its body loads when selected."
        : "Instruction is in the selected folder's expected startup path.",
      estimatedTokens: {
        startup: skill ? 0 : estimate,
        onDemand: skill ? estimate : 0
      }
    }
  };
}

function resolveEntry({
  entry,
  entries,
  context
}: ResolveInput): ResolvedEntry {
  if (!entryApplies(entry, context.workingDirectory)) {
    return {
      entry,
      resolution: {
        availability: "not-applicable",
        loading: "not-applicable",
        reason: "Source is outside the selected folder's configuration path."
      }
    };
  }
  if (entry.readState !== "readable") {
    return {
      entry,
      resolution: {
        availability: "unknown",
        loading: "unknown",
        reason: `Source is ${entry.readState}; loading cannot be determined.`
      }
    };
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
        reason: `Claude Code uses project CLAUDE.md guidance here: ${claudeFile.path}`
      }
    };
  }
  return expectedEntry(entry);
}

export function resolveInventory(
  entries: readonly InventoryEntry[],
  context: ResolutionContext
): ResolvedEntry[] {
  return entries
    .filter((entry) => entry.tool === context.tool)
    .map((entry) => resolveEntry({ entry, entries, context }));
}
