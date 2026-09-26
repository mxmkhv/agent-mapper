import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import type { Tab } from "./workspace-tabs";

export interface SearchItem {
  id: string;
  tab: Exclude<Tab, "worktree">;
  tool: ToolId | "unknown";
  title: string;
  path: string;
  state: string;
}
const resultLimit = 50;

function sourceItems(snapshot: InventorySnapshot): SearchItem[] {
  return snapshot.items.map(({ entry, resolution }) => ({
    id: entry.id,
    tab: entry.kind,
    tool: entry.tool,
    title: entry.name,
    path: entry.path,
    state: resolution.availability
  }));
}

function allItems(snapshot: InventorySnapshot): SearchItem[] {
  return [
    ...sourceItems(snapshot),
    ...snapshot.agents.map((item) => ({
      id: item.id,
      tab: "agent" as const,
      tool: item.tool,
      title: item.name,
      path: item.sourcePath,
      state: item.availability
    })),
    ...snapshot.hooks.map((item) => ({
      id: item.id,
      tab: "hook" as const,
      tool: item.tool,
      title: item.event,
      path: item.sourcePath,
      state: item.availability
    })),
    ...snapshot.plugins.map((item) => ({
      id: item.id,
      tab: "plugin" as const,
      tool: item.tool,
      title: item.name,
      path: item.sourcePath,
      state: item.state
    })),
    ...snapshot.mcpServers.map((item) => ({
      id: item.id,
      tab: "mcp" as const,
      tool: item.tool,
      title: item.name,
      path: item.sourcePath,
      state: item.availability
    })),
    ...snapshot.memories.map((item) => ({
      id: item.id,
      tab: "memory" as const,
      tool: item.tool,
      title: item.name,
      path: item.sourcePath,
      state: item.loading
    }))
  ];
}

export function findSearchItem(
  snapshot: InventorySnapshot,
  id: string
): SearchItem | undefined {
  return allItems(snapshot).find((item) => item.id === id);
}

export function searchItems(
  snapshot: InventorySnapshot,
  options: { query: string; tool: "all" | ToolId }
): SearchItem[] {
  const terms = options.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return allItems(snapshot)
    .filter((item) => options.tool === "all" || item.tool === options.tool)
    .filter((item) => {
      const haystack =
        `${item.title} ${item.path} ${item.tab} ${item.tool}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, resultLimit);
}
