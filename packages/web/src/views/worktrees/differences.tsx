import { useState } from "react";
import type {
  ComparisonSide,
  ToolId,
  WorktreeComparison
} from "@agent-mapper/core";
import { useSourceAction } from "../../state/use-source-action";
import { Button } from "../../ui/button";
import { StateMarker } from "../../ui/marks";
import { DifferenceList, differenceInfo } from "./difference-list";
import { DetailPane, EmptyState, ListPane } from "./panes";

function Side({
  label,
  side,
  workingDirectory
}: {
  label: string;
  side?: ComparisonSide;
  workingDirectory: string;
}) {
  const action = useSourceAction(workingDirectory);
  if (!side) {
    return (
      <section className="mt-5">
        <h3 className="m-0 mb-2 text-caption font-semibold text-ink-faint">
          {label}
        </h3>
        <p className="m-0 text-ink-muted">No file in this checkout.</p>
      </section>
    );
  }
  const error = action.errorFor(side.id);
  return (
    <section className="mt-5">
      <h3 className="m-0 mb-2 text-caption font-semibold text-ink-faint">
        {label}
      </h3>
      <p className="m-0 font-mono text-mono break-all">{side.path}</p>
      <p className="mt-1 mb-0 text-label text-ink-muted">
        Git: {side.tracking} · File: {side.readState}
      </p>
      <div className="mt-2.5 flex gap-2">
        <Button onClick={() => void action.run(side.id, "open")}>
          Open in editor
        </Button>
        <Button onClick={() => void action.run(side.id, "reveal")}>
          Reveal in Finder
        </Button>
      </div>
      {error ? (
        <p className="mt-2 mb-0 text-label text-problem" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

interface DifferencesProps {
  comparison: WorktreeComparison;
  tool: ToolId;
  workingDirectory: string;
  onSelectPath(path: string): void;
}

/** From a linked worktree: project configuration files that differ from the main checkout. */
export function Differences({
  comparison,
  tool,
  workingDirectory,
  onSelectPath
}: DifferencesProps) {
  const rows = comparison.differences.filter(
    (row) => row.tool === "shared" || row.tool === tool
  );
  const [selectedId, setSelectedId] = useState<string>();
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  if (!rows.length) {
    return (
      <EmptyState title="No configuration differences">
        The scanned project files match the main checkout.
      </EmptyState>
    );
  }
  return (
    <>
      <ListPane
        count={rows.length}
        title="Files that differ from the main checkout"
      >
        <DifferenceList
          onSelect={setSelectedId}
          rows={rows}
          selectedId={selected?.id}
        />
      </ListPane>
      {selected ? (
        <DetailPane
          eyebrow={`Worktree difference · ${selected.kind}`}
          key={selected.id}
          title={
            selected.relativePath.split("/").at(-1) ?? selected.relativePath
          }
        >
          <div className="mt-2 flex items-center gap-2 text-label">
            <StateMarker tier={differenceInfo[selected.state].tier} />
            <strong>{differenceInfo[selected.state].label}</strong>
          </div>
          <p className="mt-2 mb-0 text-ink-muted">
            {differenceInfo[selected.state].reason}
          </p>
          <p className="mt-3 mb-0 font-mono text-mono text-ink-muted">
            {selected.relativePath}
          </p>
          <Side
            label="Main checkout"
            side={selected.main}
            workingDirectory={workingDirectory}
          />
          <Side
            label="This checkout"
            side={selected.here}
            workingDirectory={workingDirectory}
          />
          <div className="mt-5.5 flex gap-2">
            <Button
              onClick={() => onSelectPath(comparison.mainPath)}
              variant="primary"
            >
              View main checkout
            </Button>
          </div>
        </DetailPane>
      ) : null}
    </>
  );
}
