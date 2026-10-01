import { isConventionalPath } from "../model/conventional-path";
import { canCopy } from "../model/copyable";
import { isLink } from "../model/links";
import {
  shortPath,
  tildePath,
  tildeText,
  type PathContext
} from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { stateLabel, stateText } from "../model/states";
import { Button } from "../ui/button";
import { KindIcon } from "../ui/kind-icon";
import { StateLabel, StateMarker } from "../ui/marks";
import { PathLine } from "../ui/path-line";
import { SymlinkPopover } from "../ui/symlink-popover";

export interface RowActionHandlers {
  onEdit(record: InventoryRecord): void;
  onCopy(record: InventoryRecord): void;
}

interface RowProps {
  record: InventoryRecord;
  selected: boolean;
  context: PathContext;
  /** Background versions of this plugin folded into its row. */
  otherVersions?: number;
  /** Another row in the group has the same name, so the path is what tells them apart. */
  sharesName?: boolean;
  /** Rank of the shared repo this skill was installed from; picks the dot color. */
  tone?: number;
  /** The scanned folder, for records that carry no source ref of their own. */
  workingDirectory: string;
  actions: RowActionHandlers;
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

/** Edit and Copy buttons for a file the app can open, shown in place of the state label while the row is hovered, focused or selected. */
function RowActions({ record, actions }: Pick<RowProps, "record" | "actions">) {
  return (
    <span className="hidden justify-end gap-1.5 group-focus-within:flex group-hover:flex group-aria-current:flex">
      <Button
        className="relative"
        onClick={() => actions.onEdit(record)}
        variant="primary"
      >
        Edit
      </Button>
      {canCopy(record) ? (
        <Button className="relative" onClick={() => actions.onCopy(record)}>
          Copy
        </Button>
      ) : null}
    </span>
  );
}

/**
 * The name is the row's button, stretched over the whole row; the symlink chip and the row actions sit above
 * it as buttons of their own, which a button wrapping the row could not contain.
 */
export function InventoryRow({
  record,
  selected,
  context,
  workingDirectory,
  otherVersions,
  sharesName,
  tone,
  actions,
  onSelect
}: RowProps) {
  const inactive = record.tier === "inactive";
  const linked = isLink(record);
  const hasActions = Boolean(record.sourceRef);
  return (
    <div
      aria-current={selected ? "true" : undefined}
      className={`group relative grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_112px] items-center gap-2.5 px-3 text-left [&+&]:border-t [&+&]:border-wash ${selected ? "bg-selected" : "hover:bg-hover"}`}
      title={stateText(record)}
    >
      <KindIcon kind={record.kind} />
      <StateMarker linked={linked} tier={record.tier} tone={tone} />
      <span className="flex min-w-0 items-center gap-2">
        <button
          className={`truncate text-left font-semibold outline-none after:absolute after:inset-0 after:-outline-offset-2 after:outline-focus focus-visible:after:outline-2 ${inactive ? "text-ink-muted" : ""}`}
          onClick={() => onSelect(record.id)}
          type="button"
        >
          {record.name}
        </button>
        {linked ? (
          <SymlinkPopover
            id={record.id}
            target={tildePath(record.realPath, context)}
            workingDirectory={
              record.sourceRef?.workingDirectory ?? workingDirectory
            }
          />
        ) : null}
      </span>
      <Detail context={context} record={record} sharesName={sharesName} />
      {/* A fixed last column keeps every row's detail column aligned, labelled or not. */}
      <span className="truncate text-right">
        <span
          className={
            hasActions
              ? "group-focus-within:hidden group-hover:hidden group-aria-current:hidden"
              : ""
          }
        >
          <RowLabel otherVersions={otherVersions} record={record} />
        </span>
        {hasActions ? <RowActions actions={actions} record={record} /> : null}
      </span>
    </div>
  );
}
