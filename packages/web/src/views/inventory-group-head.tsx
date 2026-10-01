import type { ToolId } from "@agent-mapper/core";
import { ChevronRight, Layers, Plug } from "lucide-react";
import { layerLabel } from "../model/layers";
import { HintText } from "../ui/hint-text";
import { sourceTone, ToolGlyph } from "../ui/marks";
import type { InventoryGroup, RowCluster } from "./inventory-groups";

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** "Global and plugins": the layers a project inherits, named in stack order. */
function inheritedLabel(groups: readonly InventoryGroup[]): string {
  const labels = [...new Set(groups.map((group) => layerLabel[group.layer]))];
  return listFormat.format(
    labels.map((label, index) => (index ? label.toLowerCase() : label))
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

export function InheritedToggle({
  groups,
  open,
  onToggle
}: {
  groups: readonly InventoryGroup[];
  open: boolean;
  onToggle(): void;
}) {
  const count = groups.reduce((sum, group) => sum + group.records.length, 0);
  return (
    <button
      aria-expanded={open}
      className="mb-3.5 flex h-9 w-full items-center gap-2 rounded-card border border-hairline bg-wash px-2.5 text-left text-label font-semibold text-ink-muted hover:border-hairline-strong"
      onClick={onToggle}
    >
      <ChevronRight
        aria-hidden="true"
        className={`size-3.5 text-ink-faint ${open ? "rotate-90" : ""}`}
        strokeWidth={1.8}
      />
      {inheritedLabel(groups)}
      <span className="font-medium text-ink-faint tabular-nums">{count}</span>
      <span className="truncate font-normal text-ink-faint">
        Comes from outside this project
      </span>
    </button>
  );
}

/** Heads the skills installed from one repo inside a group's card, and folds them away. */
export function SourceToggle({
  source,
  open,
  onToggle
}: {
  source: NonNullable<RowCluster["source"]>;
  open: boolean;
  onToggle(): void;
}) {
  return (
    <button
      aria-expanded={open}
      className="flex h-8 w-full items-center gap-2.5 bg-wash px-3 text-left hover:bg-hover [&+&]:border-t [&+&]:border-wash"
      onClick={onToggle}
    >
      <ChevronRight
        aria-hidden="true"
        className={`size-4 p-px text-ink-faint ${open ? "rotate-90" : ""}`}
        strokeWidth={1.8}
      />
      <span
        aria-hidden="true"
        className={`mx-[1.5px] size-[7px] shrink-0 rounded-full ${sourceTone(source.tone)}`}
      />
      <span className="truncate font-mono text-mono text-ink-muted">
        {source.repo}
      </span>
      <span className="text-label font-medium text-ink-faint tabular-nums">
        {source.count}
      </span>
    </button>
  );
}
