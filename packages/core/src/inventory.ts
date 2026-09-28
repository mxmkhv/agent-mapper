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
  metadataCharacters?: number;
  lineCount?: number;
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

export interface InventorySnapshot {
  workingDirectory: string;
  scannedAt: string;
  roots: { claude: string; codex: string };
  items: ResolvedEntry[];
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
