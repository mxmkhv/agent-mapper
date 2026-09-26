import type { InventorySnapshot } from "@agent-mapper/core";

export type Tab =
  "instruction" | "skill" | "agent" | "hook" | "plugin" | "mcp" | "memory";

interface TabsProps {
  tab: Tab;
  snapshot: InventorySnapshot;
  onSelect(tab: Tab): void;
}

export function WorkspaceTabs({ tab, snapshot, onSelect }: TabsProps) {
  return (
    <nav className="tabs" aria-label="Inventory views">
      <button
        className={tab === "instruction" ? "active" : ""}
        onClick={() => onSelect("instruction")}
      >
        Instructions{" "}
        <span>
          {
            snapshot.items.filter(({ entry }) => entry.kind === "instruction")
              .length
          }
        </span>
      </button>
      <button
        className={tab === "skill" ? "active" : ""}
        onClick={() => onSelect("skill")}
      >
        Skills{" "}
        <span>
          {snapshot.items.filter(({ entry }) => entry.kind === "skill").length}
        </span>
      </button>
      <button
        className={tab === "agent" ? "active" : ""}
        onClick={() => onSelect("agent")}
      >
        Agents <span>{snapshot.agents.length}</span>
      </button>
      <button
        className={tab === "hook" ? "active" : ""}
        onClick={() => onSelect("hook")}
      >
        Hooks <span>{snapshot.hooks.length}</span>
      </button>
      <button
        className={tab === "plugin" ? "active" : ""}
        onClick={() => onSelect("plugin")}
      >
        Plugins <span>{snapshot.plugins.length}</span>
      </button>
      <button
        className={tab === "mcp" ? "active" : ""}
        onClick={() => onSelect("mcp")}
      >
        MCP <span>{snapshot.mcpServers.length}</span>
      </button>
      <button
        className={tab === "memory" ? "active" : ""}
        onClick={() => onSelect("memory")}
      >
        Memory <span>{snapshot.memories.length}</span>
      </button>
    </nav>
  );
}
