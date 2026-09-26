import type { ToolId } from "@agent-mapper/core";
import type { SearchItem } from "./search";
import type { Tab } from "./workspace-tabs";

interface Setters {
  setTool(value: "all" | ToolId): void;
  setTab(value: Tab): void;
  setSelectedId(value: string): void;
  setSelectedPluginId(value: string): void;
  setSelectedHookId(value: string): void;
  setSelectedMcpId(value: string): void;
  setSelectedMemoryId(value: string): void;
  setSelectedAgentId(value: string): void;
}

export function selectSearchItem(item: SearchItem, setters: Setters): void {
  setters.setTool(item.tool === "unknown" ? "all" : item.tool);
  setters.setTab(item.tab);
  if (item.tab === "instruction" || item.tab === "skill") {
    setters.setSelectedId(item.id);
  } else if (item.tab === "plugin") {
    setters.setSelectedPluginId(item.id);
  } else if (item.tab === "hook") {
    setters.setSelectedHookId(item.id);
  } else if (item.tab === "mcp") {
    setters.setSelectedMcpId(item.id);
  } else if (item.tab === "memory") {
    setters.setSelectedMemoryId(item.id);
  } else if (item.tab === "agent") {
    setters.setSelectedAgentId(item.id);
  }
}
