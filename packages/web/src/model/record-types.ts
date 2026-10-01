import type { SkillSource, SourceRef, ToolId } from "@agent-mapper/core";

export type RecordKind =
  | "instruction"
  | "skill"
  | "command"
  | "agent"
  | "hook"
  | "mcp"
  | "memory"
  | "plugin";

export type Layer = "managed" | "global" | "plugins" | "project" | "user";

/** How loudly an item asks for attention. Active is silent; problem is the only red state. */
export type Tier = "active" | "inactive" | "unknown" | "approval" | "problem";

export interface RecordDetail {
  label: string;
  value: string;
  /** Commands, URLs, and other literal text shown in monospace. */
  code?: boolean;
}

interface PluginRef {
  id: string;
  name: string;
  version?: string;
  state: string;
}

export interface InventoryRecord {
  id: string;
  kind: RecordKind;
  tool: ToolId | "unknown";
  name: string;
  path: string;
  realPath: string;
  scope: string;
  layer: Layer;
  tier: Tier;
  /** Native state word from the resolver, e.g. "shadowed", "cached", "approval required". */
  label: string;
  reason: string;
  /** Id of the record that takes precedence over this one, when the resolver names a single winner. */
  shadowedBy?: string;
  loading?: string;
  /** Position in the source snapshot, used for startup load order. */
  order: number;
  startupTokens: number;
  lines?: number;
  characters?: number;
  /** File size, for records measured in bytes rather than characters (memory). */
  bytes?: number;
  locator?: string;
  /** Short secondary text: hook matcher, MCP transport, plugin version. */
  summary?: string;
  plugin?: PluginRef;
  /** Marketplace a plugin record was installed from. */
  marketplace?: string;
  /** Path inside the plugin install, when the record comes from a plugin. */
  pluginPath?: string;
  details: RecordDetail[];
  problems: string[];
  contributions?: Partial<Record<RecordKind, number>>;
  installedFrom?: SkillSource;
  /** The file could not be read (a broken link, missing permissions): it cannot be edited or copied, only deleted. */
  unreadable?: boolean;
  /** The scan that owns this file-backed instruction or skill; documents open through it. */
  sourceRef?: SourceRef;
}
