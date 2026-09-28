import type { InventorySnapshot, ToolId } from "@agent-mapper/core";

export function filterWorkspace(
  snapshot: InventorySnapshot,
  tool: "all" | ToolId
): InventorySnapshot {
  if (tool === "all") {
    return snapshot;
  }
  return {
    ...snapshot,
    items: snapshot.items.filter(({ entry }) => entry.tool === tool),
    plugins: snapshot.plugins.filter((item) => item.tool === tool),
    hooks: snapshot.hooks.filter((item) => item.tool === tool),
    mcpServers: snapshot.mcpServers.filter((item) => item.tool === tool),
    memories: snapshot.memories.filter((item) => item.tool === tool),
    agents: snapshot.agents.filter((item) => item.tool === tool),
    findings: snapshot.findings.filter((item) => item.tool === tool),
    comparison: snapshot.comparison && {
      ...snapshot.comparison,
      differences: snapshot.comparison.differences.filter(
        (item) => item.tool === "shared" || item.tool === tool
      )
    }
  };
}
