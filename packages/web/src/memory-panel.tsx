import { useState } from "react";
import type { MemoryRecord } from "@agent-mapper/core";
import { sourceAction } from "./api";

interface MemoryListProps {
  memories: MemoryRecord[];
  selectedId?: string;
  onSelect(id: string): void;
}

const bytesPerKilobyte = 1024;

function writerName(tool: MemoryRecord["tool"]): string {
  if (tool === "unknown") {
    return "Unknown writer";
  }
  return tool === "claude" ? "Claude Code" : "Codex";
}

function badge(memory: MemoryRecord): string {
  if (memory.readState === "unreadable") {
    return "Unreadable";
  }
  return attribution(memory);
}

function attribution(memory: MemoryRecord): string {
  return memory.projectMatch === "not applicable"
    ? memory.scope
    : memory.projectMatch;
}

function size(value: number | undefined): string {
  if (value === undefined) {
    return "size unknown";
  }
  return value < bytesPerKilobyte
    ? `${value} B`
    : `${(value / bytesPerKilobyte).toFixed(1)} KB`;
}

export function MemoryList({
  memories,
  selectedId,
  onSelect
}: MemoryListProps) {
  if (!memories.length) {
    return (
      <div className="empty-list">
        <h3>No local memory files in this view</h3>
        <p>
          Try the other tool filter or select a project. Custom memory locations
          may not appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {memories.map((memory) => (
        <button
          key={memory.id}
          className={`source-row ${selectedId === memory.id ? "selected" : ""}`}
          onClick={() => onSelect(memory.id)}
        >
          <span className={`tool-dot ${memory.tool}`} aria-hidden="true" />
          <span className="source-main">
            <strong>{memory.name}</strong>
            <small>
              {writerName(memory.tool)} · {size(memory.sizeBytes)} ·{" "}
              {memory.lineCount === undefined
                ? "line count unknown"
                : `${memory.lineCount} lines`}
            </small>
          </span>
          <span
            className={`state-badge ${memory.readState === "unreadable" ? "unknown" : ""}`}
          >
            {badge(memory)}
          </span>
        </button>
      ))}
    </div>
  );
}

interface MemoryDetailProps {
  memory?: MemoryRecord;
  workingDirectory: string;
}

export function MemoryDetail({ memory, workingDirectory }: MemoryDetailProps) {
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  }>();
  if (!memory) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select a memory file to inspect its metadata.
        </div>
      </aside>
    );
  }
  async function run(action: "open" | "reveal") {
    if (!memory) {
      return;
    }
    try {
      setActionError(undefined);
      await sourceAction({ path: workingDirectory, id: memory.id, action });
    } catch (error) {
      setActionError({
        id: memory.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return (
    <aside className="detail" key={memory.id}>
      <div className="detail-top">
        <span className="eyebrow">MEMORY FILE DETAILS</span>
        <h2>{memory.name}</h2>
        <div className="detail-tags">
          <span>{writerName(memory.tool)}</span>
          <span>{memory.scope}</span>
          <span>{memory.loading}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Attribution</h3>
        <p
          className={`state-line ${memory.projectMatch === "unmatched" || memory.projectMatch === "candidate" ? "unknown" : ""}`}
        >
          {attribution(memory)}
        </p>
        <p>{memory.reason}</p>
      </section>
      <section className="detail-section">
        <h3>File</h3>
        <p>Size: {size(memory.sizeBytes)}</p>
        <p>Lines: {memory.lineCount ?? "unknown"}</p>
        <p>Modified: {new Date(memory.modifiedAt).toLocaleString()}</p>
        <p>Read state: {memory.readState}</p>
        {memory.error ? (
          <p className="inline-error" role="alert">
            {memory.error}
          </p>
        ) : null}
        <p className="source-path">{memory.sourcePath}</p>
      </section>
      <section className="detail-section">
        <p>Memory text stays in the file. Open the source to read it.</p>
      </section>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open source</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError?.id === memory.id ? (
        <p className="inline-error" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </aside>
  );
}
