export type ToolId = "claude" | "codex";
/** Agents are scanned as `AgentRecord`s; the kind exists here so their files open as documents like the others. */
type EntryKind = "instruction" | "skill" | "command" | "agent";
type Scope = "global" | "project" | "unknown";
type EntryScope = Scope | "managed";
type HookScope = Scope | "managed";
type ReadState = "readable" | "missing" | "unreadable";

/** The repo an installed skill came from, as recorded by the `skills` installer's lock file. */
export interface SkillSource {
  repo: string;
  ref?: string;
}

export interface InventoryEntry {
  id: string;
  tool: ToolId;
  kind: EntryKind;
  name: string;
  description?: string;
  path: string;
  realPath?: string;
  projectPath?: string;
  scope: EntryScope;
  readState: ReadState;
  isSymlink: boolean;
  characters?: number;
  metadataCharacters?: number;
  lineCount?: number;
  /** Why the source could not be read. */
  error?: string;
  /**
   * The first frontmatter problem a save check finds in a readable skill: malformed YAML, no frontmatter, or a
   * missing or non-text name or description. Whether each tool still loads it is not verified, so it stays
   * expected and the problem is shown alongside.
   */
  frontmatterProblem?: string;
  preview?: string;
  pluginId?: string;
  locator?: string;
  declarationOnly?: boolean;
  inlineContent?: boolean;
  installedFrom?: SkillSource;
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
  /** Command, URL, MCP tool, or prompt the handler runs, with secret values masked. */
  preview?: string;
  locator: string;
  sourcePath: string;
  scope: HookScope;
  pluginId?: string;
  condition?: string;
  flags: string[];
  availability: "configured" | "disabled" | "conditional" | "unknown";
  reason: string;
}

import type { McpRecord } from "./mcp";
export type { McpRecord } from "./mcp";
import type { MemoryRecord } from "./memory";
export type { MemoryRecord } from "./memory";
import type { AgentRecord } from "./agent";
export type { AgentRecord } from "./agent";

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

export interface InstructionImport {
  id: string;
  sourceEntryId: string;
  sourcePath: string;
  targetPath: string;
  depth: number;
  state:
    | "readable"
    | "missing"
    | "unreadable"
    | "approval-unknown"
    | "syntax-unknown";
  reason: string;
}

export interface InventorySnapshot {
  workingDirectory: string;
  scannedAt: string;
  roots: { claude: string; codex: string };
  items: ResolvedEntry[];
  imports: InstructionImport[];
  plugins: PluginRecord[];
  hooks: HookRecord[];
  mcpServers: McpRecord[];
  memories: MemoryRecord[];
  agents: AgentRecord[];
  context: import("./context").ContextSummary;
  findings: import("./finding").Finding[];
  worktrees: import("./worktree").WorktreeRecord[];
  comparison?: import("./worktree").WorktreeComparison;
  coverage: string[];
}

export { resolveInventory } from "./resolution";
