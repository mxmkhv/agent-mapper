import { useState } from "react";
import type { Finding, ToolId } from "@agent-mapper/core";

interface FindingPanelProps {
  findings: Finding[];
  tool: "all" | ToolId;
  onOpenSource(id: string): void;
}

export function FindingPanel({
  findings,
  tool,
  onOpenSource
}: FindingPanelProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const visible = findings.filter(
    (item) => tool === "all" || item.tool === tool
  );
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  return (
    <div className="inventory-grid">
      <section className="inventory-list">
        <div className="list-heading">
          <span>FINDING</span>
          <span>LEVEL</span>
        </div>
        {visible.length === 0 ? (
          <div className="empty-list">
            <h3>No findings in this view</h3>
            <p>
              Choose another tool or rescan after changing local configuration.
            </p>
          </div>
        ) : (
          <div className="source-list">
            {visible.map((item) => (
              <button
                key={item.id}
                className={`source-row ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={`tool-dot ${item.tool}`} aria-hidden="true" />
                <span className="source-main">
                  <strong>{item.title}</strong>
                  <small>{item.sources[0]?.path}</small>
                </span>
                <span className={`state-badge finding-${item.level}`}>
                  {item.level}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <aside className="detail">
        {selected ? (
          <>
            <div className="detail-top">
              <span className="eyebrow">
                {selected.level.toUpperCase()} ·{" "}
                {selected.tool === "claude" ? "CLAUDE CODE" : "CODEX"}
              </span>
              <h2>{selected.title}</h2>
            </div>
            <section className="detail-section">
              <h3>Why it appears</h3>
              <p>{selected.reason}</p>
            </section>
            <section className="detail-section">
              <h3>{selected.sources.length === 1 ? "Source" : "Sources"}</h3>
              {selected.sources.map((source) => (
                <div className="finding-source" key={source.id}>
                  <p className="source-path">{source.path}</p>
                  <button
                    className="source-link"
                    onClick={() => onOpenSource(source.id)}
                  >
                    View source ↗
                  </button>
                </div>
              ))}
            </section>
          </>
        ) : (
          <div className="detail-empty">No finding selected.</div>
        )}
      </aside>
    </div>
  );
}
