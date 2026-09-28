import { useState } from "react";
import type { WorktreeRecord } from "@agent-mapper/core";

interface Props {
  worktrees: WorktreeRecord[];
  onSelectPath(path: string): void;
}

export function WorktreePicker({ worktrees, onSelectPath }: Props) {
  const linked = worktrees.filter((item) => !item.isMain);
  const [selectedPath, setSelectedPath] = useState<string>();
  const selected =
    linked.find((item) => item.path === selectedPath) ?? linked[0];
  return (
    <>
      <section className="inventory-list">
        <div className="list-heading">
          <span>WORKTREE</span>
          <span>GIT STATE</span>
        </div>
        {linked.length ? (
          <div className="source-list">
            {linked.map((item) => (
              <button
                key={item.path}
                className={`source-row ${selected?.path === item.path ? "selected" : ""}`}
                onClick={() => setSelectedPath(item.path)}
              >
                <span className="source-main">
                  <strong>{item.path.split("/").at(-1)}</strong>
                  <small>{item.branch ?? item.path}</small>
                </span>
                <span className={`state-badge ${item.state}`}>
                  {item.state}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-list">
            <h3>
              {worktrees.length ? "No linked worktrees" : "No Git repository"}
            </h3>
            <p>
              {worktrees.length
                ? "Git has no other checkout registered for this repository."
                : "Select a Git checkout to compare its project configuration."}
            </p>
          </div>
        )}
      </section>
      <aside className="detail">
        {selected ? (
          <>
            <div className="detail-top">
              <span className="eyebrow">WORKTREE DETAILS</span>
              <h2>{selected.path.split("/").at(-1)}</h2>
            </div>
            <section className="detail-section">
              <h3>Git state</h3>
              <p className="state-line">{selected.state}</p>
              <p>Branch: {selected.branch ?? "detached or unavailable"}</p>
              <p className="source-path">{selected.path}</p>
            </section>
            {selected.state === "available" ? (
              <div className="detail-actions">
                <button onClick={() => onSelectPath(selected.path)}>
                  Open checkout
                </button>
              </div>
            ) : (
              <p className="inline-error">
                {selected.state === "unknown"
                  ? "This checkout could not be inspected. Check permissions and the scan coverage notes."
                  : "Git still lists this checkout, but its folder is unavailable. Inspect it with git worktree list."}
              </p>
            )}
          </>
        ) : (
          <div className="detail-empty">Select a worktree to inspect it.</div>
        )}
      </aside>
    </>
  );
}
