import { useState } from "react";
import type {
  ComparisonSide,
  ToolId,
  WorktreeComparison,
  WorktreeDifference
} from "@agent-mapper/core";
import { tildePath, type PathContext } from "../../model/paths";
import { useSourceAction } from "../../state/use-source-action";
import { Button } from "../../ui/button";
import { StateMarker } from "../../ui/marks";
import { differenceSections, relevantDifferences } from "./difference-groups";
import { DifferenceList, differenceInfo } from "./difference-list";
import { PathText } from "../../ui/path-text";
import { EmptyState } from "../../ui/empty-state";
import { DetailPane, ListPane, ListSection } from "./panes";

function Side({
  label,
  side,
  context,
  workingDirectory
}: {
  label: string;
  side?: ComparisonSide;
  context: PathContext;
  workingDirectory: string;
}) {
  const action = useSourceAction(workingDirectory);
  if (!side) {
    return (
      <section className="mt-5">
        <h3 className="m-0 mb-2 text-caption font-semibold text-ink-muted">
          {label}
        </h3>
        <p className="m-0 text-ink-muted">No file in this checkout.</p>
      </section>
    );
  }
  const error = action.errorFor(side.id);
  return (
    <section className="mt-5">
      <h3 className="m-0 mb-2 text-caption font-semibold text-ink-muted">
        {label}
      </h3>
      <p className="m-0 font-mono text-mono break-words">
        <PathText path={tildePath(side.path, context)} />
      </p>
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
  context: PathContext;
  onSelectPath(path: string): void;
}

function DifferenceDetail({
  row,
  props,
  onClose
}: {
  row: WorktreeDifference;
  props: DifferencesProps;
  onClose(): void;
}) {
  const info = differenceInfo[row.state];
  return (
    <DetailPane
      eyebrow={`Worktree difference · ${row.kind}`}
      onClose={onClose}
      title={row.relativePath.split("/").at(-1) ?? row.relativePath}
    >
      <div className="mt-3 flex items-center gap-2 text-label">
        <StateMarker tier={info.tier} />
        <strong>{info.label}</strong>
      </div>
      <p className="mt-2 mb-0 text-ink-muted">{info.reason}</p>
      <p className="mt-3 mb-0 font-mono text-mono text-ink-muted">
        {row.relativePath}
      </p>
      <Side
        context={props.context}
        label="Main checkout"
        side={row.main}
        workingDirectory={props.workingDirectory}
      />
      <Side
        context={props.context}
        label="This checkout"
        side={row.here}
        workingDirectory={props.workingDirectory}
      />
      <div className="mt-5.5 flex gap-2">
        <Button
          onClick={() => props.onSelectPath(props.comparison.mainPath)}
          variant="primary"
        >
          View main checkout
        </Button>
      </div>
    </DetailPane>
  );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** From a linked worktree: project configuration files that differ from the main checkout, grouped by how. */
export function Differences(props: DifferencesProps) {
  const rows = relevantDifferences(props.comparison.differences, props.tool);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = rows.find((row) => row.id === selectedId);
  if (!rows.length) {
    return (
      <EmptyState title="No configuration differences">
        The scanned project files match the main checkout.
      </EmptyState>
    );
  }
  return (
    // The detail column opens only for a selected file, so the list keeps the full width until then;
    // narrow windows stack it under the list instead of squeezing both.
    <div
      className={`grid h-full min-h-0 ${selected ? "grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}
    >
      <ListPane>
        {differenceSections(rows).map((section) => (
          <ListSection
            count={section.groups.length}
            detail={
              section.files === section.groups.length
                ? undefined
                : plural(section.files, "file")
            }
            key={section.state}
            title={differenceInfo[section.state].label}
          >
            <DifferenceList
              groups={section.groups}
              onSelect={setSelectedId}
              selectedId={selected?.id}
            />
          </ListSection>
        ))}
      </ListPane>
      {selected ? (
        <DifferenceDetail
          key={selected.id}
          onClose={() => setSelectedId(undefined)}
          props={props}
          row={selected}
        />
      ) : null}
    </div>
  );
}
