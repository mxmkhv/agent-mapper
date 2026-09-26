import { useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { SourceList, Detail } from "./source-panel";
import { PluginList, PluginDetail } from "./plugin-panel";
import { HookList, HookDetail } from "./hook-panel";

type Tab = "instruction" | "skill" | "hook" | "plugin";
type ToolFilter = "all" | ToolId;

interface HeaderProps {
  snapshot: InventorySnapshot;
  globalView: boolean;
  tool: ToolFilter;
  onToolChange(tool: ToolFilter): void;
  onRescan(): void;
}

function Header({
  snapshot,
  globalView,
  tool,
  onToolChange,
  onRescan
}: HeaderProps) {
  const toolNames: Record<ToolFilter, string> = {
    all: "Both",
    claude: "Claude",
    codex: "Codex"
  };
  return (
    <header className="workspace-header">
      <div>
        <div className="eyebrow">
          {globalView ? "USER CONFIGURATION" : "SELECTED FOLDER"}
        </div>
        <h1 title={snapshot.workingDirectory}>
          {globalView
            ? "Global overview"
            : snapshot.workingDirectory.split("/").at(-1)}
        </h1>
        <p className="header-path">{snapshot.workingDirectory}</p>
      </div>
      <div className="header-actions">
        <div className="segmented" aria-label="Tool filter">
          {(["all", "claude", "codex"] as const).map((value) => (
            <button
              key={value}
              className={tool === value ? "selected" : ""}
              onClick={() => onToolChange(value)}
            >
              {toolNames[value]}
            </button>
          ))}
        </div>
        <button className="rescan-button" onClick={onRescan}>
          Rescan
        </button>
      </div>
    </header>
  );
}

interface WorkspaceProps {
  snapshot: InventorySnapshot;
  globalView: boolean;
  initialTool: ToolFilter;
  onRescan(): void;
}

export function Workspace({
  snapshot,
  globalView,
  initialTool,
  onRescan
}: WorkspaceProps) {
  const [tab, setTab] = useState<Tab>("instruction");
  const [tool, setTool] = useState<ToolFilter>(initialTool);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedPluginId, setSelectedPluginId] = useState<string>();
  const [selectedHookId, setSelectedHookId] = useState<string>();
  const items = snapshot.items.filter(
    ({ entry }) => entry.kind === tab && (tool === "all" || entry.tool === tool)
  );
  const plugins = snapshot.plugins.filter(
    (plugin) => tool === "all" || plugin.tool === tool
  );
  const hooks = snapshot.hooks.filter(
    (hook) => tool === "all" || hook.tool === tool
  );
  const selected =
    items.find(({ entry }) => entry.id === selectedId) ?? items[0];
  const selectedPlugin =
    plugins.find((plugin) => plugin.id === selectedPluginId) ?? plugins[0];
  const selectedHook =
    hooks.find((hook) => hook.id === selectedHookId) ?? hooks[0];
  function openEntry(id: string) {
    const hook = snapshot.hooks.find((item) => item.id === id);
    if (hook) {
      setTool(hook.tool);
      setTab("hook");
      setSelectedHookId(id);
      return;
    }
    const entry = snapshot.items.find((item) => item.entry.id === id);
    if (!entry) {
      return;
    }
    setTool(entry.entry.tool);
    setTab(entry.entry.kind);
    setSelectedId(id);
  }
  function selectPlugin(id: string) {
    setSelectedPluginId(id);
    setTab("plugin");
  }
  function listContent() {
    if (tab === "hook") {
      return (
        <HookList
          hooks={hooks}
          selectedId={selectedHook?.id}
          onSelect={setSelectedHookId}
        />
      );
    }
    if (tab === "plugin") {
      return (
        <PluginList
          plugins={plugins}
          selectedId={selectedPlugin?.id}
          onSelect={setSelectedPluginId}
        />
      );
    }
    return (
      <SourceList
        items={items}
        selectedId={selected?.entry.id}
        onSelect={setSelectedId}
      />
    );
  }
  function detailContent() {
    if (tab === "hook") {
      return (
        <HookDetail
          hook={selectedHook}
          workingDirectory={snapshot.workingDirectory}
          onSelectPlugin={selectPlugin}
        />
      );
    }
    if (tab === "plugin") {
      return (
        <PluginDetail
          plugin={selectedPlugin}
          workingDirectory={snapshot.workingDirectory}
          onOpenEntry={openEntry}
        />
      );
    }
    return (
      <Detail
        item={selected}
        workingDirectory={snapshot.workingDirectory}
        onSelectPlugin={selectPlugin}
      />
    );
  }
  return (
    <div className="workspace">
      <Header
        snapshot={snapshot}
        globalView={globalView}
        tool={tool}
        onToolChange={setTool}
        onRescan={onRescan}
      />
      <div className="coverage-note">
        Fresh local CLI model · {snapshot.items.length} sources ·{" "}
        {snapshot.hooks.length} hooks · {snapshot.plugins.length} plugins ·
        Scanned {new Date(snapshot.scannedAt).toLocaleTimeString()}
      </div>
      <nav className="tabs" aria-label="Inventory views">
        <button
          className={tab === "instruction" ? "active" : ""}
          onClick={() => setTab("instruction")}
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
          onClick={() => setTab("skill")}
        >
          Skills{" "}
          <span>
            {
              snapshot.items.filter(({ entry }) => entry.kind === "skill")
                .length
            }
          </span>
        </button>
        <button
          className={tab === "hook" ? "active" : ""}
          onClick={() => setTab("hook")}
        >
          Hooks <span>{snapshot.hooks.length}</span>
        </button>
        <button
          className={tab === "plugin" ? "active" : ""}
          onClick={() => setTab("plugin")}
        >
          Plugins <span>{snapshot.plugins.length}</span>
        </button>
      </nav>
      <div className="inventory-grid">
        <section className="inventory-list">
          <div className="list-heading">
            <span>NAME</span>
            <span>EXPECTED STATE</span>
          </div>
          {listContent()}
        </section>
        {detailContent()}
      </div>
      {snapshot.coverage.length > 0 ? (
        <details className="coverage">
          <summary>
            Coverage and scan notes · {snapshot.coverage.length}
          </summary>
          <ul>
            {snapshot.coverage.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
