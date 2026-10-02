import type { InventoryRecord } from "../model/record-types";
import type { Landing } from "../shell/view-bar";
import { stateText } from "../model/states";
import { StateMarker } from "../ui/marks";
import { sectionHeading } from "./inspector-sections";
import { recordKey, type ScannedProject } from "../model/scanned-project";

export interface ReachScope {
  projects: ScannedProject[];
  onOpen(path: string, landing?: Landing): void;
}

/** Which projects a source outside any project actually reaches, and in what state. */
export function ReachSection({
  record,
  reach
}: {
  record: InventoryRecord;
  reach: ReachScope;
}) {
  const key = recordKey(record);
  const rows = reach.projects.map((project) => ({
    project,
    match: project.records?.find((item) => recordKey(item) === key)
  }));
  const applies = rows.filter((row) => row.match?.tier === "active").length;
  return (
    <section className="mt-5">
      <h3 className={sectionHeading}>
        Reaches {applies} of {rows.length} projects
      </h3>
      <div className="grid gap-0.5">
        {rows.map(({ project, match }) => (
          <button
            className="flex h-7 w-full items-center gap-2 px-2 text-left hover:bg-wash"
            key={project.path}
            onClick={() =>
              reach.onOpen(
                project.path,
                match ? { selectId: match.id } : undefined
              )
            }
          >
            {match ? (
              <StateMarker tier={match.tier} />
            ) : (
              <span className="inline-block h-px w-[7px] bg-ink-muted" />
            )}
            <span className="flex-1 truncate">{project.name}</span>
            <span className="text-caption text-ink-muted">
              {reachLabel(project, match)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function reachLabel(project: ScannedProject, match?: InventoryRecord): string {
  if (project.refreshing) {
    return "Rescanning…";
  }
  if (project.error !== undefined) {
    return "Scan failed";
  }
  if (!project.records) {
    return "Scanning…";
  }
  return match ? stateText(match) : "Not reached";
}
