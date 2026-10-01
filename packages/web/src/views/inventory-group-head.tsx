import type { ToolId } from "@agent-mapper/core";
import type { ReactNode } from "react";
import { ChevronRight, Layers, Plug } from "lucide-react";
import { layerLabel } from "../model/layers";
import { HintText } from "../ui/hint-text";
import { StateMarker, ToolGlyph } from "../ui/marks";
import type { ClusterSource, InventoryGroup } from "./inventory-groups";

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** "Global and plugins": the layers a project inherits, named in stack order. */
function inheritedLabel(groups: readonly InventoryGroup[]): string {
  const labels = [...new Set(groups.map((group) => layerLabel[group.layer]))];
  return listFormat.format(
    labels.map((label, index) => (index ? label.toLowerCase() : label))
  );
}

function FoldChevron({ open, size }: { open: boolean; size: string }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={`${size} text-ink-faint ${open ? "rotate-90" : ""}`}
      strokeWidth={1.8}
    />
  );
}

export function GroupHead({
  group,
  hint,
  localTool
}: {
  group: InventoryGroup;
  hint?: string;
  /** Set on the open project's own groups, which carry the tool glyph and a full-strength label. */
  localTool?: ToolId;
}) {
  const Icon = group.plugin ? Plug : Layers;
  return (
    <div
      className={`flex h-[30px] items-center gap-2 px-2.5 text-label font-semibold ${localTool ? "text-ink" : "text-ink-muted"}`}
    >
      {localTool ? (
        <ToolGlyph tool={localTool} />
      ) : (
        <Icon
          aria-hidden="true"
          className="size-3.5 text-ink-faint"
          strokeWidth={1.6}
        />
      )}
      {group.label}
      {group.plugin?.version ? (
        <span className="font-mono text-caption font-normal text-ink-faint">
          {group.plugin.version}
        </span>
      ) : null}
      <span className="font-medium text-ink-faint tabular-nums">
        {group.records.length}
      </span>
      {hint ? <HintText hint={hint} /> : null}
    </div>
  );
}

/** Everything a project inherits, in one wash panel: its head folds the groups inside it away. */
export function InheritedSection({
  groups,
  open,
  onToggle,
  children
}: {
  groups: readonly InventoryGroup[];
  open: boolean;
  onToggle(): void;
  children: ReactNode;
}) {
  const count = groups.reduce((sum, group) => sum + group.records.length, 0);
  return (
    <section className="mb-3.5 rounded-card border border-hairline bg-wash">
      <button
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-card px-2.5 text-left text-label font-semibold text-ink-muted hover:text-ink"
        onClick={onToggle}
        type="button"
      >
        <FoldChevron open={open} size="size-3.5" />
        {inheritedLabel(groups)}
        <span className="font-medium text-ink-faint tabular-nums">{count}</span>
        <span className="truncate font-normal text-ink-faint">
          Comes from outside this project
        </span>
      </button>
      {open ? <div className="px-2.5">{children}</div> : null}
    </section>
  );
}

/** Heads the skills installed from one repo inside a group's card, and folds them away. */
export function SourceToggle({
  source,
  open,
  onToggle
}: {
  source: ClusterSource;
  open: boolean;
  onToggle(): void;
}) {
  return (
    <button
      aria-expanded={open}
      className="flex h-8 w-full items-center gap-2.5 bg-wash px-3 text-left hover:bg-hover [&+&]:border-t [&+&]:border-wash"
      onClick={onToggle}
    >
      <FoldChevron open={open} size="size-4 p-px" />
      <StateMarker tier="active" tone={source.tone} />
      <span className="truncate font-mono text-mono text-ink-muted">
        {source.repo}
      </span>
      <span className="text-label font-medium text-ink-faint tabular-nums">
        {source.count}
      </span>
    </button>
  );
}
