import type { Finding, InstructionImport, ToolId } from "@agent-mapper/core";
import { isLink } from "../model/links";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { CopyTarget } from "../model/copy-targets";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { stateText } from "../model/states";
import type { DocumentMode } from "../documents/source-document-panel";
import { useSourceAction } from "../state/use-source-action";
import { Button } from "../ui/button";
import { PixelIcon } from "../ui/pixel-icon";
import { KindIcon, kindSingular } from "../ui/kind-icon";
import { StateMarker, ToolGlyph } from "../ui/marks";
import { SymlinkPopover } from "../ui/symlink-popover";
import {
  Contributions,
  Details,
  Imports,
  Provenance,
  Section,
  sizeText
} from "./inspector-sections";
import { Links, PrecedenceSection } from "./precedence-section";
import { ReachSection, type ReachScope } from "./reach-section";
import { pluginGroupKey } from "../views/inventory-groups";
import { ItemFile } from "./item-actions";

interface InspectorScope {
  records: InventoryRecord[];
  findings: Finding[];
  imports: InstructionImport[];
  context: PathContext;
  workingDirectory: string;
  scannedAt: string;
  copyTargets: readonly CopyTarget[];
}

interface RecordInspectorProps {
  record: InventoryRecord;
  scope: InspectorScope;
  onSelect(id: string, options?: { tool?: ToolId }): void;
  /** Shows a plugin's contributions of one kind in the Inventory. */
  onKind(kind: RecordKind, group: string): void;
  onOpenDocument(sourceKey: string, mode: DocumentMode): void;
  /** Present in the Global view: which projects this record reaches. */
  reach?: ReachScope;
}

/**
 * State and size on one line. The resolver's reason explains only what is not normal; for an active item it
 * restates the label, so it moves to the label's tooltip.
 */
function StateLine({
  record,
  context
}: {
  record: InventoryRecord;
  context: PathContext;
}) {
  const reason = tildeText(record.reason, context);
  const normal = record.tier === "active";
  // "36 lines · ~591 tokens": each part leads with its figure, which takes the pixel face.
  const sizes = sizeText(record)?.split(" · ") ?? [];
  return (
    <>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-[7px] gap-y-1 text-label text-ink-muted">
        <span className="inline-flex text-ink">
          <StateMarker tier={record.tier} />
        </span>
        <strong
          className={`font-semibold ${record.tier === "problem" ? "text-problem" : "text-ink"}`}
          title={normal ? reason : undefined}
        >
          {stateText(record)}
        </strong>
        {sizes.map((size) => {
          const space = size.indexOf(" ");
          return (
            <span key={size}>
              ·{" "}
              <span className="font-mono text-mono">
                {size.slice(0, space)}
              </span>
              {size.slice(space)}
            </span>
          );
        })}
      </div>
      {normal ? null : <p className="mt-2 mb-0 text-ink-muted">{reason}</p>}
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
  // An instruction or skill picked in the Global view carries its own project's scan; other kinds use this view's.
  const workingDirectory =
    record.sourceRef?.workingDirectory ?? scope.workingDirectory;
  const action = useSourceAction(workingDirectory);
  const imports = scope.imports.filter(
    (item) => item.sourceEntryId === record.id
  );
  const error = action.errorFor(record.id);
  const linked = isLink(record);
  return (
    <div className="px-5 pt-4.5 pb-7">
      <div className="flex items-center gap-2 text-label text-ink-muted">
        <KindIcon kind={record.kind} />
        {kindSingular[record.kind]}
        <ToolGlyph tool={record.tool} />
        {linked ? (
          <SymlinkPopover
            id={record.id}
            target={tildePath(record.realPath, scope.context)}
            workingDirectory={workingDirectory}
          />
        ) : null}
      </div>
      <h2 className="mt-2.5 mb-0 font-mono text-headline break-words">
        {record.name}
        {/* Inline, so the cursor follows the last line of a wrapped name. */}
        <span
          aria-hidden="true"
          className="ml-1.5 inline-block h-[30px] w-[21px] bg-accent"
        />
      </h2>
      <StateLine context={scope.context} record={record} />
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
        <ItemFile
          onOpenDocument={onOpenDocument}
          onSelect={onSelect}
          record={record}
          scope={scope}
          sourceRef={record.sourceRef}
        />
      ) : null}
      <PrecedenceSection onSelect={onSelect} record={record} scope={scope} />
      <Links onSelect={onSelect} record={record} scope={scope} />
      {record.kind === "plugin" ? (
        <Section title="Contributes">
          <Contributions
            onKind={(kind) => onKind(kind, pluginGroupKey(record.id))}
            record={record}
          />
        </Section>
      ) : null}
      {imports.length ? (
        <Section title="Imports">
          <Imports context={scope.context} imports={imports} />
        </Section>
      ) : null}
      <Details context={scope.context} record={record} />
      {reach ? <ReachSection reach={reach} record={record} /> : null}
      <div className="mt-5.5 flex flex-wrap gap-2">
        {/* Files the app can edit already lead with Edit; keep one primary action per inspector. */}
        <Button
          onClick={() => void action.run(record.id, "open")}
          variant={record.sourceRef ? "secondary" : "primary"}
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
        <PixelIcon className="mx-auto" large name="layers" />
        <p>
          Select anything to see where it comes from, why it applies, and what
          else links to it.
        </p>
        <p>
          <span className="font-mono text-mono">{active}</span> active ·{" "}
          <span className="font-mono text-mono">{inactive}</span> inactive for{" "}
          {tool}
        </p>
      </div>
    </div>
  );
}
