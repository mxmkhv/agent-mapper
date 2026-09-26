import { useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { SourceList, Detail } from "./source-panel";
import { PluginList, PluginDetail } from "./plugin-panel";
import { HookList, HookDetail } from "./hook-panel";
import { McpList, McpDetail } from "./mcp-panel";
import { MemoryList, MemoryDetail } from "./memory-panel";
import { AgentList, AgentDetail } from "./agent-panel";
import { WorktreePanel } from "./worktree-panel";
import { CoverageNotes, WorkspaceSummary } from "./workspace-summary";
import { WorkspaceTabs, type Tab } from "./workspace-tabs";

type ToolFilter = "all" | ToolId;

import { Header } from "./workspace-header";

interface WorkspaceProps {
  snapshot: InventorySnapshot;
  globalView: boolean;
  initialTool: ToolFilter;
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
  const [tool, setTool] = useState<ToolFilter>(initialTool);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedPluginId, setSelectedPluginId] = useState<string>();
  const [selectedHookId, setSelectedHookId] = useState<string>();
  const [selectedMcpId, setSelectedMcpId] = useState<string>();
  const [selectedMemoryId, setSelectedMemoryId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const items = snapshot.items.filter(
    ({ entry }) => entry.kind === tab && (tool === "all" || entry.tool === tool)
  );
  const plugins = snapshot.plugins.filter(
    (plugin) => tool === "all" || plugin.tool === tool
  );
  const hooks = snapshot.hooks.filter(
    (hook) => tool === "all" || hook.tool === tool
  );
  const mcpServers = snapshot.mcpServers.filter(
    (server) => tool === "all" || server.tool === tool
  );
  const memories = snapshot.memories.filter(
    (memory) => tool === "all" || memory.tool === tool
  );
  const agents = snapshot.agents.filter(
    (agent) => tool === "all" || agent.tool === tool
  );
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
    const agent = snapshot.agents.find((item) => item.id === id);
    if (agent) {
      setTool(agent.tool);
      setTab("agent");
      setSelectedAgentId(id);
      return;
    }
    const server = snapshot.mcpServers.find((item) => item.id === id);
    if (server) {
      setTool(server.tool);
      setTab("mcp");
      setSelectedMcpId(id);
      return;
    }
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
        onRescan={onRescan}
      />
      <WorkspaceSummary snapshot={snapshot} />
      <WorkspaceTabs tab={tab} snapshot={snapshot} onSelect={setTab} />
      <div className="inventory-grid">
        {tab === "worktree" ? (
          <WorktreePanel
            worktrees={snapshot.worktrees}
            comparison={snapshot.comparison}
            tool={tool}
            workingDirectory={snapshot.workingDirectory}
            onSelectPath={onSelectPath}
          />
        ) : (
          <>
            <section className="inventory-list">
              <div className="list-heading">
                <span>NAME</span>
                <span>EXPECTED STATE</span>
              </div>
              {listContent()}
            </section>
            {detailContent()}
          </>
        )}
      </div>
      <CoverageNotes notes={snapshot.coverage} />
    </div>
  );
}
