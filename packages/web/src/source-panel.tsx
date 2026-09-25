import { useState } from "react";
import type { ResolvedEntry } from "@agent-mapper/core";
import { sourceAction } from "./api";

interface SourceListProps {
  items: ResolvedEntry[];
  selectedId?: string;
  onSelect(id: string): void;
}

export function SourceList({ items, selectedId, onSelect }: SourceListProps) {
  if (items.length === 0) {
    return (
      <div className="empty-list">
        <h3>No sources in this view</h3>
        <p>
          Try the other tab or tool filter. You can also add another folder.
        </p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {items.map(({ entry, resolution }) => (
        <button
          key={entry.id}
          className={`source-row ${selectedId === entry.id ? "selected" : ""}`}
          onClick={() => onSelect(entry.id)}
        >
          <span className={`tool-dot ${entry.tool}`} aria-hidden="true" />
          <span className="source-main">
            <strong>{entry.name}</strong>
            <small>{entry.path}</small>
          </span>
          <span className={`state-badge ${resolution.availability}`}>
            {resolution.availability}
          </span>
        </button>
      ))}
    </div>
  );
}

interface DetailProps {
  item?: ResolvedEntry;
  workingDirectory: string;
}

export function Detail({ item, workingDirectory }: DetailProps) {
  const [actionError, setActionError] = useState("");
  if (!item) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select a source to see where it came from.
        </div>
      </aside>
    );
  }
  const { entry, resolution } = item;
  async function run(action: "open" | "reveal") {
    if (!item) {
      return;
    }
    try {
      setActionError("");
      await sourceAction({ path: workingDirectory, id: item.entry.id, action });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <aside className="detail" key={entry.id}>
      <div className="detail-top">
        <span className="eyebrow">SOURCE DETAILS</span>
        <h2>{entry.name}</h2>
        <div className="detail-tags">
          <span>{entry.tool === "claude" ? "Claude Code" : "Codex"}</span>
          <span>{entry.scope}</span>
          <span>{entry.kind}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Expected behavior</h3>
        <p className={`state-line ${resolution.availability}`}>
          {resolution.availability} · {resolution.loading}
        </p>
        <p>{resolution.reason}</p>
      </section>
      <section className="detail-section">
        <h3>Source</h3>
        <p className="source-path">{entry.path}</p>
        {entry.isSymlink ? (
          <p>Linked target: {entry.realPath ?? "unavailable"}</p>
        ) : null}
        {entry.error ? <p className="inline-error">{entry.error}</p> : null}
      </section>
      {entry.description ? (
        <section className="detail-section">
          <h3>Description</h3>
          <p>{entry.description}</p>
        </section>
      ) : null}
      <section className="detail-section">
        <h3>Content</h3>
        <p>
          Open the local file to inspect its contents. Unstructured text is kept
          out of the browser response until preview redaction is verified.
        </p>
      </section>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open in editor</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError ? (
        <p className="inline-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </aside>
  );
}
