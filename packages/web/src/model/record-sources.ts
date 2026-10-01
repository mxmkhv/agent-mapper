import type {
  AgentRecord,
  HookRecord,
  McpRecord,
  MemoryRecord,
  PluginRecord,
  ResolvedEntry
} from "@agent-mapper/core";
import type { InventoryRecord, RecordDetail, RecordKind } from "./record-types";

/** Fields every converter fills; build-records adds layer, tier and plugin provenance. */
export type RecordDraft = Omit<
  InventoryRecord,
  "layer" | "tier" | "plugin" | "pluginPath"
> & {
  pluginId?: string;
  readState?: string;
};

const detail = (label: string, value: string | undefined): RecordDetail[] =>
  value ? [{ label, value }] : [];

export function entryDraft(
  { entry, resolution }: ResolvedEntry,
  order: number
): RecordDraft {
  return {
    id: entry.id,
    kind: entry.kind,
    tool: entry.tool,
    name: entry.name,
    path: entry.path,
    realPath: entry.realPath ?? entry.path,
    scope: entry.scope,
    label: resolution.availability,
    reason: resolution.reason,
    loading: resolution.loading,
    order,
    startupTokens: resolution.estimatedTokens?.startup ?? 0,
    lines: entry.lineCount,
    characters: entry.characters,
    locator: entry.locator,
    pluginId: entry.pluginId,
    readState: entry.readState,
    installedFrom: entry.installedFrom,
    details: [
      ...detail("Description", entry.description),
      ...detail(
        "Installed from",
        entry.installedFrom &&
          [entry.installedFrom.repo, entry.installedFrom.ref]
            .filter(Boolean)
            .join(" @ ")
      ),
      ...detail(
        "Declared in",
        entry.declarationOnly ? "configuration" : undefined
      )
    ],
    problems: [entry.error, entry.frontmatterProblem].filter(
      (problem): problem is string => Boolean(problem)
    )
  };
}

export function agentDraft(agent: AgentRecord, order: number): RecordDraft {
  return {
    id: agent.id,
    kind: "agent",
    tool: agent.tool,
    name: agent.name,
    path: agent.sourcePath,
    realPath: agent.realPath ?? agent.sourcePath,
    scope: agent.scope,
    label: agent.availability,
    reason: agent.reason,
    order,
    startupTokens: 0,
    characters: agent.characters,
    locator: agent.locator,
    pluginId: agent.pluginId,
    readState: agent.readState,
    details: [
      { label: "Format", value: agent.format === "toml" ? "TOML" : "Markdown" },
      {
        label: "Description",
        value: agent.descriptionPresent ? "present" : "not found"
      }
    ],
    problems: []
  };
}

const previewLabels = new Map([
  ["command", "Command"],
  ["http", "URL"],
  ["mcp_tool", "MCP tool"],
  ["prompt", "Prompt"],
  ["agent", "Prompt"]
]);

function hookPreview(hook: HookRecord): RecordDetail[] {
  const label = previewLabels.get(hook.handlerType);
  return hook.preview && label
    ? [
        {
          label,
          value: hook.preview,
          code: hook.handlerType !== "prompt" && hook.handlerType !== "agent"
        }
      ]
    : [];
}

export function hookDraft(hook: HookRecord, order: number): RecordDraft {
  return {
    id: hook.id,
    kind: "hook",
    tool: hook.tool,
    name: hook.event,
    path: hook.sourcePath,
    realPath: hook.sourcePath,
    scope: hook.scope,
    label: hook.availability,
    reason: hook.reason,
    loading: hook.availability === "conditional" ? "conditional" : undefined,
    order,
    startupTokens: 0,
    locator: hook.locator,
    summary: hook.matcher ?? "all matches",
    pluginId: hook.pluginId,
    details: [
      { label: "Lane", value: hook.lane },
      { label: "Handler", value: hook.handlerType },
      ...hookPreview(hook),
      { label: "Matcher", value: hook.matcher ?? "all matches" },
      ...detail("Condition", hook.condition),
      ...detail("Flags", hook.flags.join(" · "))
    ],
    problems: []
  };
}

export function mcpDraft(server: McpRecord, order: number): RecordDraft {
  return {
    id: server.id,
    kind: "mcp",
    tool: server.tool,
    name: server.name,
    path: server.sourcePath,
    realPath: server.sourcePath,
    scope: server.scope,
    label: server.availability,
    reason: server.reason,
    order,
    startupTokens: 0,
    locator: server.locator,
    summary: server.transport,
    pluginId: server.pluginId,
    details: [
      { label: "Transport", value: server.transport },
      { label: "Destination", value: server.destination },
      ...detail("Env names", server.envNames.join(", ")),
      ...detail("Header names", server.headerNames.join(", "))
    ],
    problems: []
  };
}

export function memoryDraft(memory: MemoryRecord, order: number): RecordDraft {
  return {
    id: memory.id,
    kind: "memory",
    tool: memory.tool,
    name: memory.name,
    path: memory.sourcePath,
    realPath: memory.sourcePath,
    scope: memory.scope,
    label: memory.loading,
    reason: memory.reason,
    loading: memory.loading,
    order,
    startupTokens: 0,
    lines: memory.lineCount,
    bytes: memory.sizeBytes,
    readState: memory.readState,
    details: [
      { label: "Project match", value: memory.projectMatch },
      {
        label: "Modified",
        value: new Date(memory.modifiedAt).toLocaleString()
      }
    ],
    problems: memory.error ? [memory.error] : []
  };
}

export function pluginDraft(plugin: PluginRecord, order: number): RecordDraft {
  const contributions: Partial<Record<RecordKind, number>> = {};
  for (const item of plugin.contributions) {
    contributions[item.kind] = (contributions[item.kind] ?? 0) + 1;
  }
  const path = plugin.installPath ?? plugin.sourcePath;
  return {
    id: plugin.id,
    kind: "plugin",
    tool: plugin.tool,
    name: plugin.name,
    path,
    realPath: path,
    scope: plugin.scope,
    label: plugin.state,
    reason: plugin.reason,
    order,
    startupTokens: 0,
    summary: plugin.version,
    marketplace: plugin.marketplace,
    details: [
      ...detail("Installation", plugin.installationEvidence),
      ...detail("Settings", plugin.settingsEvidence)
    ],
    problems: plugin.issues ?? [],
    contributions
  };
}
