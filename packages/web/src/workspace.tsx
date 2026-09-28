import { useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { SourceList, Detail } from "./source-panel";
import { PluginList, PluginDetail } from "./plugin-panel";
import { HookList, HookDetail } from "./hook-panel";
import { McpList, McpDetail } from "./mcp-panel";
import { MemoryList, MemoryDetail } from "./memory-panel";
import { AgentList, AgentDetail } from "./agent-panel";
import { InventoryView } from "./inventory-view";
import { CoverageNotes, WorkspaceSummary } from "./workspace-summary";
import { WorkspaceTabs, type Tab } from "./workspace-tabs";
import { SearchPalette } from "./search-palette";
import { findSearchItem, type SearchItem } from "./search";
import { ContextSummaryPanel } from "./context-summary";
import { useSearchShortcut } from "./use-search-shortcut";
import { selectSearchItem } from "./search-navigation";
import { filterWorkspace } from "./workspace-filter";

import { Header } from "./workspace-header";

interface WorkspaceProps {
  snapshot: InventorySnapshot;
  globalView: boolean;
  initialTool: "all" | ToolId;
  initialTab: Tab;
  onRescan(): void;
  onSelectPath(path: string): void;
}

export function Workspace({
  snapshot,
  globalView,
  initialTool,
  initialTab,
  onRescan,
  onSelectPath
}: WorkspaceProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tool, setTool] = useState<"all" | ToolId>(initialTool);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedPluginId, setSelectedPluginId] = useState<string>();
  const [selectedHookId, setSelectedHookId] = useState<string>();
  const [selectedMcpId, setSelectedMcpId] = useState<string>();
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(setSearchOpen);
  const visible = filterWorkspace(snapshot, tool);
  const items = visible.items.filter(
    ({ entry }) =>
      entry.kind === tab || (tab === "skill" && entry.kind === "command")
  );
  if (tab === "skill") {
    items.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }
  const { plugins, hooks, mcpServers, memories, agents } = visible;
  const selected =
    items.find(({ entry }) => entry.id === selectedId) ?? items[0];
  const selectedPlugin =
    plugins.find((plugin) => plugin.id === selectedPluginId) ?? plugins[0];
  const selectedHook =
    hooks.find((hook) => hook.id === selectedHookId) ?? hooks[0];
  const selectedMcp =
    mcpServers.find((server) => server.id === selectedMcpId) ?? mcpServers[0];
  const selectedMemory =
    memories.find((memory) => memory.id === selectedMemoryId) ?? memories[0];
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  function openEntry(id: string) {
    const target = findSearchItem(snapshot, id);
    if (target) {
      openSearchItem(target);
    }
  }
  function selectPlugin(id: string) {
    setSelectedPluginId(id);
    setTab("plugin");
  }
  function openSearchItem(item: SearchItem) {
    selectSearchItem(item, {
      setTool,
      setTab,
      setSelectedId,
      setSelectedPluginId,
      setSelectedHookId,
      setSelectedMcpId,
      setSelectedMemoryId,
      setSelectedAgentId
    });
    setSearchOpen(false);
  }
  function listContent() {
    if (tab === "agent") {
      return (
        <AgentList
          agents={agents}
          selectedId={selectedAgent?.id}
          onSelect={setSelectedAgentId}
        />
      );
    }
    if (tab === "memory") {
      return (
        <MemoryList
          memories={memories}
          selectedId={selectedMemory?.id}
          onSelect={setSelectedMemoryId}
        />
      );
    }
    if (tab === "mcp") {
      return (
        <McpList
          servers={mcpServers}
          selectedId={selectedMcp?.id}
          onSelect={setSelectedMcpId}
        />
      );
    }
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
    if (tab === "agent") {
      return (
        <AgentDetail
          agent={selectedAgent}
          workingDirectory={snapshot.workingDirectory}
          onSelectPlugin={selectPlugin}
        />
      );
    }
    if (tab === "memory") {
      return (
        <MemoryDetail
          memory={selectedMemory}
          workingDirectory={snapshot.workingDirectory}
        />
      );
    }
    if (tab === "mcp") {
      return (
        <McpDetail
          server={selectedMcp}
          workingDirectory={snapshot.workingDirectory}
          onSelectPlugin={selectPlugin}
        />
      );
    }
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
        onSearch={() => setSearchOpen(true)}
        onRescan={onRescan}
      />
      <WorkspaceSummary snapshot={visible} />
      <ContextSummaryPanel context={snapshot.context} tool={tool} />
      <WorkspaceTabs tab={tab} snapshot={visible} onSelect={setTab} />
      <InventoryView
        snapshot={visible}
        tab={tab}
        tool={tool}
        list={listContent()}
        detail={detailContent()}
        onOpenSource={openEntry}
        onSelectPath={onSelectPath}
      />
      <CoverageNotes notes={snapshot.coverage} />
      {searchOpen ? (
        <SearchPalette
          snapshot={snapshot}
          tool={tool}
          onOpen={openSearchItem}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}
