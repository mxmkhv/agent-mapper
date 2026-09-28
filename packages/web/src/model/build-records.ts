import type { InventorySnapshot, PluginRecord } from "@agent-mapper/core";
import { layerOf } from "./layers";
import type { InventoryRecord } from "./record-types";
import {
  agentDraft,
  entryDraft,
  hookDraft,
  mcpDraft,
  memoryDraft,
  pluginDraft,
  type RecordDraft
} from "./record-sources";
import { tierOf } from "./states";

function drafts(snapshot: InventorySnapshot): RecordDraft[] {
  const sources = [
    snapshot.items.map(entryDraft),
    snapshot.agents.map(agentDraft),
    snapshot.hooks.map(hookDraft),
    snapshot.mcpServers.map(mcpDraft),
    snapshot.memories.map(memoryDraft),
    snapshot.plugins.map(pluginDraft)
  ];
  let order = 0;
  return sources.flat().map((draft) => ({ ...draft, order: order++ }));
}

function finish(
  draft: RecordDraft,
  plugins: Map<string, PluginRecord>
): InventoryRecord {
  const { pluginId, readState, ...rest } = draft;
  const plugin = pluginId ? plugins.get(pluginId) : undefined;
  const record: InventoryRecord = {
    ...rest,
    layer: layerOf(draft),
    tier: rest.problems.length ? "problem" : tierOf(draft.label, readState)
  };
  if (!plugin) {
    return record;
  }
  const inside =
    plugin.installPath && draft.path.startsWith(`${plugin.installPath}/`);
  record.plugin = {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    state: plugin.state
  };
  record.pluginPath = inside
    ? draft.path.slice((plugin.installPath ?? "").length + 1)
    : undefined;
  // A cached plugin version is not selected, so nothing it declares applies here.
  if (plugin.state === "cached" && record.tier !== "problem") {
    record.tier = "inactive";
    record.label = "cached version";
  }
  return record;
}

/** One uniform list for every view: each record knows its layer, state tier and provenance. */
export function buildRecords(snapshot: InventorySnapshot): InventoryRecord[] {
  const plugins = new Map(
    snapshot.plugins.map((plugin) => [plugin.id, plugin])
  );
  return drafts(snapshot).map((draft) => finish(draft, plugins));
}
