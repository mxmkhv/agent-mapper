import { isLink } from "../model/links";
import { shortPath, tildePath, type PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { stateLabel, stateText } from "../model/states";
import { KindIcon } from "../ui/kind-icon";
import { StateLabel, StateMarker, SymlinkBadge } from "../ui/marks";
import { PathLine } from "../ui/path-line";

interface RowProps {
  record: InventoryRecord;
  selected: boolean;
  context: PathContext;
  onSelect(id: string): void;
}

function Detail({ record, context }: Pick<RowProps, "record" | "context">) {
  if (record.kind === "hook" || record.kind === "mcp") {
    const text = record.details
      .filter((detail) =>
        ["Handler", "Matcher", "Transport", "Destination"].includes(
          detail.label
        )
      )
      .map((detail) => detail.value)
      .join(" · ");
    return <span className="truncate text-mono text-ink-faint">{text}</span>;
  }
  if (record.kind === "plugin") {
    const marketplace = record.details.find(
      (detail) => detail.label === "Marketplace"
    )?.value;
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {[record.summary, marketplace].filter(Boolean).join(" · ")}
      </span>
    );
  }
  return (
    <PathLine
      path={record.pluginPath ?? shortPath(record.path, context)}
      title={tildePath(record.path, context)}
    />
  );
}

export function InventoryRow({
  record,
  selected,
  context,
  onSelect
}: RowProps) {
  const inactive = record.tier === "inactive";
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={`grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2.5 px-3 text-left [&+&]:border-t [&+&]:border-wash ${selected ? "bg-selected" : "hover:bg-hover"}`}
      onClick={() => onSelect(record.id)}
      title={stateText(record)}
    >
      <KindIcon kind={record.kind} />
      <StateMarker tier={record.tier} />
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`truncate font-semibold ${inactive ? "text-ink-muted" : ""}`}
        >
          {record.name}
        </span>
        {isLink(record) ? (
          <SymlinkBadge target={tildePath(record.realPath, context)} />
        ) : null}
      </span>
      <Detail context={context} record={record} />
      <StateLabel text={stateLabel(record)} tier={record.tier} />
    </button>
  );
}
