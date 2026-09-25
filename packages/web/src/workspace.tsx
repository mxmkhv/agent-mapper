import { useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { SourceList, Detail } from "./source-panel";

type Tab = "instruction" | "skill";
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
  const items = snapshot.items.filter(
    ({ entry }) => entry.kind === tab && (tool === "all" || entry.tool === tool)
  );
  const selected =
    items.find(({ entry }) => entry.id === selectedId) ?? items[0];
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
        Fresh local CLI model · {snapshot.items.length} sources · Scanned{" "}
        {new Date(snapshot.scannedAt).toLocaleTimeString()}
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
      </nav>
      <div className="inventory-grid">
        <section className="inventory-list">
          <div className="list-heading">
            <span>NAME</span>
            <span>EXPECTED STATE</span>
          </div>
          <SourceList
            items={items}
            selectedId={selected?.entry.id}
            onSelect={setSelectedId}
          />
        </section>
        <Detail item={selected} workingDirectory={snapshot.workingDirectory} />
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
