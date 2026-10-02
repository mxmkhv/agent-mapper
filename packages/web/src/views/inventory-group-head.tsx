import type { ToolId } from "@agent-mapper/core";
import type { ReactNode } from "react";
import { layerLabel } from "../model/layers";
import { HintText } from "../ui/hint-text";
import { ToolGlyph } from "../ui/marks";
import { PixelIcon } from "../ui/pixel-icon";
import type { ClusterSource, InventoryGroup } from "./inventory-groups";

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** "Global and plugins": the layers a project inherits, named in stack order. */
function inheritedLabel(groups: readonly InventoryGroup[]): string {
  const labels = [...new Set(groups.map((group) => layerLabel[group.layer]))];
  return listFormat.format(
    labels.map((label, index) => (index ? label.toLowerCase() : label))
  );
}

function FoldChevron({ open }: { open: boolean }) {
  return <PixelIcon name={open ? "chevron-down" : "chevron-right"} />;
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
  return (
    <div className="flex h-[26px] items-stretch border-b-2 border-rule">
      <span className="flex min-w-0 items-center gap-2 bg-ink pr-3 pl-2.5 font-mono text-mono text-canvas">
        {localTool ? (
          <ToolGlyph tool={localTool} />
        ) : (
          <PixelIcon name={group.plugin ? "plug" : "globe"} />
        )}
        <span className="truncate">{group.label}</span>
        {group.plugin?.version ? (
          <span className="opacity-70">{group.plugin.version}</span>
        ) : null}
        {group.records.length}
      </span>
      {hint ? (
        <span className="flex min-w-0 items-center truncate px-3">
          <HintText hint={hint} />
        </span>
      ) : null}
      {/* A light dot fill runs the tab out to the edge of the group. */}
      <span
        aria-hidden="true"
        className="dots-light min-w-6 flex-1 bg-ink [mask-position:0_1px]"
      />
    </div>
  );
}

/** Everything a project inherits, in one dotted panel: its head folds the groups inside it away. */
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
    <section className="mb-3.5 border border-dotted border-ink-muted">
      <button
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-2.5 px-2.5 text-left text-label font-semibold hover:bg-wash"
        onClick={onToggle}
        type="button"
      >
        <FoldChevron open={open} />
        {inheritedLabel(groups)}
        <span className="font-mono text-mono text-ink-faint">{count}</span>
        <span className="truncate font-normal text-ink-faint">
          Comes from outside this project
        </span>
      </button>
      {open ? <div className="px-2.5 pt-1">{children}</div> : null}
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
      className="flex h-8 w-full items-center gap-3 border-b border-dotted border-hairline bg-wash px-3 text-left hover:bg-selected"
      onClick={onToggle}
    >
      <FoldChevron open={open} />
      <span className="truncate font-mono text-mono">{source.repo}</span>
      <span className="font-mono text-mono text-ink-muted">{source.count}</span>
    </button>
  );
}
