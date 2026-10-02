import { isConventionalPath } from "../model/conventional-path";
import { canCopy, canDelete, canEdit } from "../model/copyable";
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
import { PixelIcon } from "../ui/pixel-icon";
import { SymlinkPopover } from "../ui/symlink-popover";

export interface RowActionHandlers {
  onEdit(record: InventoryRecord): void;
  onCopy(record: InventoryRecord): void;
  onDelete(record: InventoryRecord): void;
}

interface RowProps {
  record: InventoryRecord;
  selected: boolean;
  context: PathContext;
  /** Background versions of this plugin folded into its row. */
  otherVersions?: number;
  /** How the record relates to its competitors, e.g. "overrides AGENTS.md"; shown when it has no state label. */
  relation?: string;
  /** Another row in the group has the same name, so the path is what tells them apart. */
  sharesName?: boolean;
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
  showPath
}: Pick<RowProps, "record" | "context"> & {
  /** Show the path even where it is conventional, because it is what tells this row apart. */
  showPath?: boolean;
}) {
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
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {text}
      </span>
    );
  }
  if (record.kind === "plugin") {
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {[record.summary, record.marketplace].filter(Boolean).join(" · ")}
      </span>
    );
  }
  // The row already names the item; a conventional path would only repeat the group and the name.
  if (!isLink(record) && !showPath && isConventionalPath(record, context)) {
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
  relation,
  otherVersions
}: Pick<RowProps, "record" | "relation" | "otherVersions">) {
  const label = stateLabel(record);
  const versions = otherVersions
    ? `+${otherVersions} other ${otherVersions === 1 ? "version" : "versions"}`
    : undefined;
  const note = relation ?? versions;
  if (label || !note) {
    return <StateLabel text={label} tier={record.tier} />;
  }
  return (
    <span className="text-caption whitespace-nowrap text-ink-faint">
      {note}
    </span>
  );
}

/**
 * Edit, Copy and Delete for a file the app can open, shown while the row is hovered, focused or selected. They
 * float over the right end of the row on the row's own fill, so the columns keep their widths. On the selected
 * row they switch to the accent pair and leave room for the dither edge.
 */
function RowActions({
  record,
  actions,
  selected
}: Pick<RowProps, "record" | "actions" | "selected">) {
  return (
    <span
      className={`keep-color absolute inset-y-0 right-0 hidden items-center gap-1.5 pl-3 group-focus-within:flex group-hover:flex group-aria-current:flex ${selected ? "bg-accent pr-9" : "bg-surface pr-3 group-hover:bg-wash"}`}
    >
      {canEdit(record) ? (
        <Button
          className="relative"
          onClick={() => actions.onEdit(record)}
          variant={selected ? "accentPrimary" : "primary"}
        >
          Edit
        </Button>
      ) : null}
      {canCopy(record) ? (
        <Button
          className="relative"
          onClick={() => actions.onCopy(record)}
          variant={selected ? "accentSecondary" : "secondary"}
        >
          Copy
        </Button>
      ) : null}
      {canDelete(record) ? (
        <Button
          aria-label={`Delete ${record.name}`}
          className="relative"
          onClick={() => actions.onDelete(record)}
          title="Delete…"
          variant={selected ? "accentIcon" : "icon"}
        >
          <PixelIcon name="trash" />
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
  relation,
  sharesName,
  actions,
  onSelect
}: RowProps) {
  const inactive = record.tier === "inactive";
  const linked = isLink(record);
  const hasActions = canEdit(record) || canDelete(record);
  return (
    <div
      aria-current={selected ? "true" : undefined}
      className={`group relative grid h-9 w-full grid-cols-[11px_7px_minmax(0,1fr)_minmax(0,1fr)_132px] items-center gap-3 px-3 text-left [&+&]:border-t [&+&]:border-dotted [&+&]:border-hairline ${selected ? "on-accent bg-accent" : "hover:bg-wash"}`}
      title={stateText(record)}
    >
      <KindIcon kind={record.kind} />
      <StateMarker tier={record.tier} />
      <span className="flex min-w-0 items-center gap-2">
        <button
          className={`truncate text-left font-semibold outline-none after:absolute after:inset-0 after:-outline-offset-2 after:outline-ink focus-visible:after:outline-2 ${inactive ? "text-ink-muted" : ""}`}
          onClick={() => onSelect(record.id)}
          type="button"
        >
          {record.name}
        </button>
        {selected ? (
          <span
            aria-hidden="true"
            className="h-[13px] w-[7px] shrink-0 bg-current"
          />
        ) : null}
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
      <Detail
        context={context}
        record={record}
        showPath={sharesName || Boolean(relation)}
      />
      {/* A fixed last column keeps every row's detail column aligned, labelled or not. */}
      {/* The floating actions may be narrower than the label, so it steps aside instead of peeking out. */}
      <span
        className={`truncate text-right ${hasActions ? "group-focus-within:invisible group-hover:invisible group-aria-current:invisible" : ""}`}
      >
        <RowLabel
          otherVersions={otherVersions}
          record={record}
          relation={relation}
        />
      </span>
      {hasActions ? (
        <RowActions actions={actions} record={record} selected={selected} />
      ) : null}
      {selected ? (
        <span
          aria-hidden="true"
          className="dots-fade pointer-events-none absolute inset-y-0 right-0 w-6 bg-canvas"
        />
      ) : null}
    </div>
  );
}
