import { useState } from "react";
import type {
  ComparisonSide,
  WorktreeComparison,
  WorktreeDifference,
  WorktreeRecord
} from "@agent-mapper/core";
import type { ToolId } from "@agent-mapper/core";
import { sourceAction } from "./api";
import { WorktreePicker } from "./worktree-picker";

interface Props {
  worktrees: WorktreeRecord[];
  comparison?: WorktreeComparison;
  workingDirectory: string;
  onSelectPath(path: string): void;
  tool?: "all" | ToolId;
}

function stateLabel(state: WorktreeDifference["state"]): string {
  return {
    "only-main": "Only in main checkout",
    "only-here": "Only here",
    "different-content": "Different content",
    unknown: "Unknown"
  }[state];
}

function stateReason(state: WorktreeDifference["state"]): string {
  return {
    "only-main":
      "This file is absent here. It does not contribute to this checkout's inventory.",
    "only-here": "This file exists only in the selected checkout.",
    "different-content":
      "Both checkouts have this file, but their contents differ.",
    unknown:
      "At least one file could not be read. Open the source and check permissions or its link target."
  }[state];
}

function DifferenceList({
  comparison,
  selectedId,
  onSelect
}: {
  comparison: WorktreeComparison;
  selectedId?: string;
  onSelect(id: string): void;
}) {
  if (!comparison.differences.length) {
    return (
      <div className="empty-list">
        <h3>No configuration differences</h3>
        <p>The scanned project files match the main checkout.</p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {comparison.differences.map((row) => (
        <button
          key={row.id}
          className={`source-row ${selectedId === row.id ? "selected" : ""}`}
          onClick={() => onSelect(row.id)}
        >
          <span className="source-main">
            <strong>{row.relativePath.split("/").at(-1)}</strong>
            <small>
              {row.relativePath} · {row.kind}
            </small>
          </span>
          <span className={`state-badge ${row.state}`}>
            {stateLabel(row.state)}
          </span>
        </button>
      ))}
    </div>
  );
}

function SideSource({
  label,
  side,
  workingDirectory
}: {
  label: string;
  side?: ComparisonSide;
  workingDirectory: string;
}) {
  const [error, setError] = useState("");
  if (!side) {
    return <p>{label}: no file in this checkout.</p>;
  }
  async function run(action: "open" | "reveal") {
    if (!side) {
      return;
    }
    try {
      setError("");
      await sourceAction({ path: workingDirectory, id: side.id, action });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <div className="worktree-side">
      <h4>{label}</h4>
      <p className="source-path">{side.path}</p>
      <p>
        Git: {side.tracking} · File: {side.readState}
      </p>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>
          Open {label.toLowerCase()} source
        </button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DifferenceDetail({
  row,
  comparison,
  workingDirectory,
  onSelectPath
}: {
  row?: WorktreeDifference;
  comparison: WorktreeComparison;
  workingDirectory: string;
  onSelectPath(path: string): void;
}) {
  if (!row) {
    return (
      <aside className="detail">
        <div className="detail-empty">No differences to inspect.</div>
      </aside>
    );
  }
  return (
    <aside className="detail" key={row.id}>
      <div className="detail-top">
        <span className="eyebrow">WORKTREE DIFFERENCE</span>
        <h2>{row.relativePath.split("/").at(-1)}</h2>
        <div className="detail-tags">
          <span>{row.kind}</span>
          <span>{row.relativePath}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Comparison</h3>
        <p className="state-line worktree-neutral">{stateLabel(row.state)}</p>
        <p>{stateReason(row.state)}</p>
      </section>
      <section className="detail-section">
        <SideSource
          label="Main"
          side={row.main}
          workingDirectory={workingDirectory}
        />
        <SideSource
          label="This checkout"
          side={row.here}
          workingDirectory={workingDirectory}
        />
      </section>
      <div className="detail-actions">
        <button onClick={() => onSelectPath(comparison.mainPath)}>
          View main checkout
        </button>
      </div>
    </aside>
  );
}

export function WorktreePanel({
  worktrees,
  comparison,
  workingDirectory,
  onSelectPath,
  tool = "all"
}: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  if (!comparison) {
    return <WorktreePicker worktrees={worktrees} onSelectPath={onSelectPath} />;
  }
  const visible = {
    ...comparison,
    differences: comparison.differences.filter(
      (row) => tool === "all" || row.tool === "shared" || row.tool === tool
    )
  };
  const selected =
    visible.differences.find((row) => row.id === selectedId) ??
    visible.differences[0];
  return (
    <>
      <section className="inventory-list">
        <div className="list-heading">
          <span>PROJECT FILE</span>
          <span>COMPARED WITH MAIN</span>
        </div>
        <DifferenceList
          comparison={visible}
          selectedId={selected?.id}
          onSelect={setSelectedId}
        />
      </section>
      <DifferenceDetail
        row={selected}
        comparison={comparison}
        workingDirectory={workingDirectory}
        onSelectPath={onSelectPath}
      />
    </>
  );
}
