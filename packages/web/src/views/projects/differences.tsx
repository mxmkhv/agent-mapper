import { useState } from "react";
import type { InventoryRecord } from "../../model/record-types";
import type { Landing } from "../../shell/view-bar";
import type { ScannedProject } from "../../model/scanned-project";
import type { Difference, DifferenceGroup } from "./projects-model";

/** A text button that sits inline in a table cell. */
export const cellLinkClass =
  "rounded-control px-1 -mx-1 text-left hover:bg-hover hover:underline";

/** How many sources a state names before the rest fold into a count. */
const namedDifferences = 3;

/** Hooks are named by their event, so the matcher is what tells two of them apart. */
function sourceName(record: InventoryRecord): string {
  return record.kind === "hook" && record.summary
    ? `${record.name} · ${record.summary}`
    : record.name;
}

function DifferenceLine({
  group,
  onOpen
}: {
  group: DifferenceGroup;
  onOpen(item: Difference): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.items : group.items.slice(0, namedDifferences);
  const more = group.items.length - shown.length;
  return (
    <p className="m-0 flex flex-wrap gap-x-2">
      <span className="text-ink-muted">{group.state}</span>
      {shown.map((item) => (
        <button
          className={`font-semibold ${cellLinkClass}`}
          key={item.source.id}
          onClick={() => onOpen(item)}
        >
          {sourceName(item.source)}
        </button>
      ))}
      {more > 0 ? (
        <button
          className={`text-ink-muted ${cellLinkClass}`}
          onClick={() => setExpanded(true)}
        >
          +{more} more
        </button>
      ) : null}
    </p>
  );
}

/** Global sources that do not apply plainly in the project, one line per state they have there. */
export function Differences({
  groups,
  project,
  onSelect,
  onOpenProject
}: {
  groups: DifferenceGroup[];
  project: ScannedProject;
  onSelect(record: InventoryRecord): void;
  onOpenProject(path: string, landing?: Landing): void;
}) {
  if (!groups.length) {
    return <span className="text-ink-faint">Same as global</span>;
  }
  // A source the project's scan lists opens there; one it never reached is explained by the global record.
  const open = ({ source, match }: Difference) =>
    match
      ? onOpenProject(project.path, { selectId: match.id })
      : onSelect(source);
  return (
    <div className="grid gap-0.5">
      {groups.map((group) => (
        <DifferenceLine group={group} key={group.state} onOpen={open} />
      ))}
    </div>
  );
}
