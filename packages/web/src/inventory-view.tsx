import type { ReactNode } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { FindingPanel } from "./finding-panel";
import { WorktreePanel } from "./worktree-panel";
import type { Tab } from "./workspace-tabs";

interface InventoryViewProps {
  snapshot: InventorySnapshot;
  tab: Tab;
  tool: "all" | ToolId;
  list: ReactNode;
  detail: ReactNode;
  onOpenSource(id: string): void;
  onSelectPath(path: string): void;
}

export function InventoryView({
  snapshot,
  tab,
  tool,
  list,
  detail,
  onOpenSource,
  onSelectPath
}: InventoryViewProps) {
  if (tab === "finding") {
    return (
      <FindingPanel
        findings={snapshot.findings}
        tool={tool}
        onOpenSource={onOpenSource}
      />
    );
  }
  return (
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
            {list}
          </section>
          {detail}
        </>
      )}
    </div>
  );
}
