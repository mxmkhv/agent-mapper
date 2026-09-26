import type { InventorySnapshot, ToolId } from "@agent-mapper/core";

type ToolFilter = "all" | ToolId;

interface HeaderProps {
  snapshot: InventorySnapshot;
  globalView: boolean;
  tool: ToolFilter;
  onToolChange(tool: ToolFilter): void;
  onRescan(): void;
}

export function Header({
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
