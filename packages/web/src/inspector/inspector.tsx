import type { InstructionImport } from "@agent-mapper/core";
import { Info, Layers } from "lucide-react";
import { isLink, linkedFrom, linkTarget } from "../model/links";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { stateText } from "../model/states";
import {
  SourceDocumentPanel,
  type DocumentMode
} from "../documents/source-document-panel";
import { useSourceAction } from "../state/use-source-action";
import { Button } from "../ui/button";
import { PathText } from "../ui/path-text";
import { KindIcon, kindSingular } from "../ui/kind-icon";
import { StateMarker, SymlinkBadge, ToolGlyph } from "../ui/marks";
import {
  Contributions,
  Details,
  Imports,
  LinkRow,
  Provenance,
  Section
} from "./inspector-sections";
import { ReachSection, type ReachScope } from "./reach-section";

interface InspectorScope {
  records: InventoryRecord[];
  imports: InstructionImport[];
  context: PathContext;
  workingDirectory: string;
  scannedAt: string;
}

interface RecordInspectorProps {
  record: InventoryRecord;
  scope: InspectorScope;
  onSelect(id: string): void;
  onKind(kind: RecordKind): void;
  onOpenDocument(sourceKey: string, mode: DocumentMode): void;
  /** Present in the Global view: which projects this record reaches. */
  reach?: ReachScope;
}

function Links({
  record,
  scope,
  onSelect
}: Pick<RecordInspectorProps, "record" | "scope" | "onSelect">) {
  const target = isLink(record) ? linkTarget(record, scope.records) : undefined;
  const sources = linkedFrom(record, scope.records);
  return (
    <>
      {isLink(record) ? (
        <Section title="Symlink to">
          {target ? (
            <LinkRow
              context={scope.context}
              onSelect={onSelect}
              record={target}
            />
          ) : (
            <p className="m-0 font-mono text-mono break-words">
              <PathText path={tildePath(record.realPath, scope.context)} />
            </p>
          )}
        </Section>
      ) : null}
      {sources.length ? (
        <Section
          title={`Linked from ${sources.length} ${sources.length === 1 ? "place" : "places"}`}
        >
          {sources.map((source) => (
            <LinkRow
              context={scope.context}
              key={source.id}
              onSelect={onSelect}
              record={source}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}

export function RecordInspector({
  record,
  scope,
  onSelect,
  onKind,
  onOpenDocument,
  reach
}: RecordInspectorProps) {
  // An instruction or skill picked from Global reach carries its own project's scan; other kinds use this view's.
  const action = useSourceAction(
    record.sourceRef?.workingDirectory ?? scope.workingDirectory
  );
  const imports = scope.imports.filter(
    (item) => item.sourceEntryId === record.id
  );
  const error = action.errorFor(record.id);
  return (
    <div className="px-5 pt-4.5 pb-7">
      <div className="flex items-center gap-1.5 text-label text-ink-muted">
        <KindIcon kind={record.kind} small />
        {kindSingular[record.kind]}
        <ToolGlyph tool={record.tool} />
        {isLink(record) ? (
          <SymlinkBadge target={tildePath(record.realPath, scope.context)} />
        ) : null}
      </div>
      <h2 className="mt-1.5 mb-1 text-headline font-semibold tracking-tight break-words">
        {record.name}
      </h2>
      <div className="mt-2 flex items-center gap-2 text-label">
        <StateMarker tier={record.tier} />
        <strong className={record.tier === "problem" ? "text-problem" : ""}>
          {stateText(record)}
        </strong>
      </div>
      <p className="mt-2 mb-0 text-ink-muted">
        {tildeText(record.reason, scope.context)}
      </p>
      {record.problems.map((problem) => (
        <p
          className="mt-2 mb-0 text-label text-problem"
          key={problem}
          role="alert"
        >
          {problem}
        </p>
      ))}
      <Provenance context={scope.context} onSelect={onSelect} record={record} />
      {record.sourceRef ? (
        <Section title="Source">
          <SourceDocumentPanel
            onOpen={onOpenDocument}
            scannedAt={scope.scannedAt}
            sourceRef={record.sourceRef}
          />
        </Section>
      ) : null}
      <Links onSelect={onSelect} record={record} scope={scope} />
      {record.kind === "plugin" ? (
        <Section title="Contributes">
          <Contributions onKind={onKind} record={record} />
        </Section>
      ) : null}
      {imports.length ? (
        <Section title="Imports">
          <Imports context={scope.context} imports={imports} />
        </Section>
      ) : null}
      <Section title="Details">
        <Details context={scope.context} record={record} />
      </Section>
      {reach ? <ReachSection reach={reach} record={record} /> : null}
      <div className="mt-5.5 flex gap-2">
        <Button
          onClick={() => void action.run(record.id, "open")}
          variant="primary"
        >
          Open in editor
        </Button>
        <Button onClick={() => void action.run(record.id, "reveal")}>
          Reveal in Finder
        </Button>
      </div>
      {error ? (
        <p className="mt-2 mb-0 text-label text-problem" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function InspectorEmpty({
  active,
  inactive,
  tool
}: {
  active: number;
  inactive: number;
  tool: string;
}) {
  return (
    <div className="grid h-full place-items-center p-10 text-center text-ink-faint">
      <div>
        <Layers
          aria-hidden="true"
          className="mx-auto size-4"
          strokeWidth={1.6}
        />
        <p>
          Select anything to see where it comes from, why it applies, and what
          else links to it.
        </p>
        <p>
          {active} active · {inactive} inactive for {tool}
        </p>
      </div>
    </div>
  );
}

export function CoverageInspector({ notes }: { notes: string[] }) {
  return (
    <div className="px-5 pt-4.5 pb-7">
      <div className="flex items-center gap-1.5 text-label text-ink-muted">
        <Info aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
        Coverage
      </div>
      <h2 className="mt-1.5 mb-1 text-headline font-semibold tracking-tight">
        What this scan can't see
      </h2>
      <p className="mt-2 text-ink-muted">
        These limits apply to every view. An empty list does not prove a tool
        has nothing configured.
      </p>
      <ul className="mt-4 grid list-disc gap-2 pl-4 text-ink-muted">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
