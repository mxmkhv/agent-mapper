import { Link2 } from "lucide-react";
import { isLink, linkFolder, sharedLinkFolder } from "../../model/links";
import { shortPath, tildePath, type PathContext } from "../../model/paths";
import type { InventoryRecord, RecordKind } from "../../model/record-types";
import { telltaleFolders } from "../../model/same-names";
import { stateLabel, stateText } from "../../model/states";
import { KindIcon, kindLabel } from "../../ui/kind-icon";
import { StateLabel, StateMarker, SymlinkBadge } from "../../ui/marks";

interface ItemProps {
  selectedId?: string;
  context: PathContext;
  onSelect(id: string): void;
}

const chipTone = {
  active: "bg-wash border-transparent",
  inactive: "border-hairline text-ink-muted",
  unknown: "border-dashed border-hairline-strong",
  approval: "border-dashed border-hairline-strong",
  problem: "border-problem text-problem"
} satisfies Record<InventoryRecord["tier"], string>;

/** Chip border and fill follow the state: solid wash when active, outline when inactive, dashed when unknown. */
export function chipClass(record: InventoryRecord, selectedId?: string) {
  return record.id === selectedId
    ? "border-ink bg-surface"
    : chipTone[record.tier];
}

function Chip({
  record,
  showLink,
  folder,
  quiet,
  ...props
}: ItemProps & {
  record: InventoryRecord;
  showLink: boolean;
  /** For a name shared with another chip in the row: the folder that tells them apart. */
  folder?: string;
  /** The row already states this chip's state, so the chip draws as normal. */
  quiet: boolean;
}) {
  const plain = quiet || record.tier === "active";
  return (
    <button
      className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-control border px-2 text-label hover:border-hairline-strong ${quiet && record.id !== props.selectedId ? chipTone.active : chipClass(record, props.selectedId)}`}
      onClick={() => props.onSelect(record.id)}
      title={stateText(record)}
    >
      {plain ? null : <StateMarker tier={record.tier} />}
      <span className="truncate">{record.name}</span>
      {folder ? (
        <span className="truncate font-mono text-caption text-ink-faint">
          {folder}
        </span>
      ) : null}
      {record.kind === "hook" || record.kind === "mcp" ? (
        <span className="truncate text-caption text-ink-faint">
          {record.summary}
        </span>
      ) : null}
      {showLink && isLink(record) ? (
        <span title={`Symlink → ${tildePath(record.realPath, props.context)}`}>
          <Link2
            aria-label="symlink"
            className="size-3 text-ink-muted"
            strokeWidth={1.8}
          />
        </span>
      ) : null}
    </button>
  );
}

const chipLimit = 16;

/**
 * When every item in a row is unknown for the same reason (Codex project trust, say), the row says it once
 * instead of drawing the same dashed state on each chip.
 */
function sharedUnknownReason(
  records: readonly InventoryRecord[]
): string | undefined {
  const [first] = records;
  const shared =
    records.length > 1 &&
    records.every(
      (record) => record.tier === "unknown" && record.reason === first?.reason
    );
  return shared ? first?.reason : undefined;
}

interface ChipRowProps extends ItemProps {
  kind: RecordKind;
  records: InventoryRecord[];
  order: Map<string, number>;
  onMore(kind: RecordKind): void;
}

export function ChipRow({
  kind,
  records,
  order,
  onMore,
  ...props
}: ChipRowProps) {
  const shared = sharedLinkFolder(records);
  const folders = telltaleFolders(records, props.context);
  const unknownReason = sharedUnknownReason(records);
  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-1.5 px-2 py-2 [&+&]:border-t [&+&]:border-wash">
      <span className="pt-0.5">
        <KindIcon kind={kind} />
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1.5 text-label text-ink-muted">
          <strong className="font-semibold text-ink">{kindLabel[kind]}</strong>
          <span className="tabular-nums">{records.length}</span>
          {shared ? (
            <SymlinkBadge
              target={tildePath(shared.folder, props.context)}
              text={`${shared.count === records.length ? "all" : shared.count} symlinked → ${shortPath(shared.folder, props.context)}/`}
            />
          ) : null}
          {unknownReason ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-caption text-ink-muted">
              <StateMarker tier="unknown" />
              <span className="truncate" title={unknownReason}>
                {unknownReason}
              </span>
            </span>
          ) : null}
        </div>
        {kind === "instruction" ? (
          <LoadList order={order} records={records} {...props} />
        ) : (
          <div className="flex flex-wrap gap-1">
            {records.slice(0, chipLimit).map((record) => (
              <Chip
                folder={folders.get(record.id)}
                key={record.id}
                quiet={Boolean(unknownReason)}
                record={record}
                showLink={!shared || linkFolder(record) !== shared.folder}
                {...props}
              />
            ))}
            {records.length > chipLimit ? (
              <button
                className="inline-flex h-6 items-center rounded-control border border-dashed border-hairline-strong px-2 text-label text-ink-muted hover:text-ink"
                onClick={() => onMore(kind)}
              >
                +{records.length - chipLimit} more
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadList({
  records,
  order,
  ...props
}: ItemProps & { records: InventoryRecord[]; order: Map<string, number> }) {
  return (
    <div className="grid gap-0.5">
      {records.map((record) => (
        <button
          className={`grid h-[30px] w-full grid-cols-[18px_auto_minmax(0,1fr)] items-center gap-2 rounded-control px-2 text-left ${record.id === props.selectedId ? "bg-selected" : "hover:bg-hover"}`}
          key={record.id}
          onClick={() => props.onSelect(record.id)}
          title={stateText(record)}
        >
          <span className="text-right font-mono text-caption font-semibold text-ink-faint">
            {order.get(record.id) ?? "–"}
          </span>
          <span className="flex items-center gap-2">
            <StateMarker tier={record.tier} />
            <span
              className={`font-semibold ${record.tier === "inactive" ? "text-ink-muted" : ""}`}
            >
              {record.name}
            </span>
            {isLink(record) ? (
              <SymlinkBadge
                target={tildePath(record.realPath, props.context)}
              />
            ) : null}
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 text-caption text-ink-muted">
            <span className="hidden truncate font-mono text-mono text-ink-faint xl:inline">
              {shortPath(record.path, props.context)}
            </span>
            <StateLabel text={stateLabel(record)} tier={record.tier} />
            {record.lines ? (
              <span className="whitespace-nowrap">{record.lines} lines</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
