import { isConventionalPath } from "../model/conventional-path";
import { isLink } from "../model/links";
import {
  shortPath,
  tildePath,
  tildeText,
  type PathContext
} from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { stateLabel, stateText } from "../model/states";
import { KindIcon } from "../ui/kind-icon";
import { StateLabel, StateMarker, SymlinkBadge } from "../ui/marks";
import { PathLine } from "../ui/path-line";

interface RowProps {
  record: InventoryRecord;
  selected: boolean;
  context: PathContext;
  /** Background versions of this plugin folded into its row. */
  otherVersions?: number;
  /** Another row in the group has the same name, so the path is what tells them apart. */
  sharesName?: boolean;
  onSelect(id: string): void;
}

/** Row-only: project hook scripts read as project-relative paths, so the script name survives truncation. */
function shortCommand(command: string, context: PathContext): string {
  return tildeText(
    command.replace(/"?\$\{?CLAUDE_PROJECT_DIR\}?"?\//g, ""),
    context
  );
}

function Detail({
  record,
  context,
  sharesName
}: Pick<RowProps, "record" | "context" | "sharesName">) {
  if (record.kind === "hook") {
    // What the hook runs comes first: it says more than the matcher or handler type, and long matchers would truncate it away.
    const runs =
      record.details.find((detail) => detail.code)?.value ??
      record.details.find((detail) => detail.label === "Handler")?.value;
    const matcher = record.details.find(
      (detail) => detail.label === "Matcher"
    )?.value;
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {[runs && shortCommand(runs, context), matcher]
          .filter(Boolean)
          .join(" · ")}
      </span>
    );
  }
  if (record.kind === "mcp") {
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
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {[record.summary, record.marketplace].filter(Boolean).join(" · ")}
      </span>
    );
  }
  // The row already names the item; a conventional path would only repeat the group and the name.
  if (!isLink(record) && !sharesName && isConventionalPath(record, context)) {
    return <span />;
  }
  return (
    <PathLine
      path={record.pluginPath ?? shortPath(record.path, context)}
      title={tildePath(record.path, context)}
    />
  );
}

function RowLabel({
  record,
  otherVersions
}: Pick<RowProps, "record" | "otherVersions">) {
  const label = stateLabel(record);
  if (label || !otherVersions) {
    return <StateLabel text={label} tier={record.tier} />;
  }
  return (
    <span className="text-caption whitespace-nowrap text-ink-faint">
      +{otherVersions} other {otherVersions === 1 ? "version" : "versions"}
    </span>
  );
}

export function InventoryRow({
  record,
  selected,
  context,
  otherVersions,
  sharesName,
  onSelect
}: RowProps) {
  const inactive = record.tier === "inactive";
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={`grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_112px] items-center gap-2.5 px-3 text-left [&+&]:border-t [&+&]:border-wash ${selected ? "bg-selected" : "hover:bg-hover"}`}
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
      <Detail context={context} record={record} sharesName={sharesName} />
      {/* A fixed last column keeps every row's detail column aligned, labelled or not. */}
      <span className="truncate text-right">
        <RowLabel otherVersions={otherVersions} record={record} />
      </span>
    </button>
  );
}
