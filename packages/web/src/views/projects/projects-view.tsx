import type { ToolId } from "@agent-mapper/core";
import type { ReactNode } from "react";
import { tildePath, type PathContext } from "../../model/paths";
import type { InventoryRecord } from "../../model/record-types";
import { scanFailed, type ScannedProject } from "../../model/scanned-project";
import { approxTokens } from "../../model/startup";
import type { Landing } from "../../shell/view-bar";
import { EmptyState } from "../../ui/empty-state";
import { FindingCounts } from "../../ui/finding-counts";
import { KindIcon, kindLabel, kindSingular } from "../../ui/kind-icon";
import {
  differencesFromGlobal,
  projectOwn,
  startupTokens,
  type Difference,
  type DifferenceGroup
} from "./projects-model";

interface ProjectsViewProps {
  globalRecords: readonly InventoryRecord[];
  projects: readonly ScannedProject[];
  tool: ToolId;
  context: PathContext;
  showInactive: boolean;
  /** The global startup summary every project builds on. */
  summary: ReactNode;
  /** Shows a global source in the inspector. */
  onSelect(record: InventoryRecord): void;
  onOpenProject(path: string, landing?: Landing): void;
}

type RowProps = Pick<
  ProjectsViewProps,
  "globalRecords" | "tool" | "showInactive" | "onSelect" | "onOpenProject"
> & { project: ScannedProject };

const linkClass =
  "rounded-control px-1 -mx-1 text-left hover:bg-hover hover:underline";

/** How many sources a state names before the rest fold into a count. */
const namedDifferences = 3;

function Differences({
  groups,
  project,
  onSelect,
  onOpenProject
}: Pick<RowProps, "project" | "onSelect" | "onOpenProject"> & {
  groups: DifferenceGroup[];
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
      {groups.map((group) => {
        const more = group.items.length - namedDifferences;
        return (
          <p className="m-0 flex flex-wrap gap-x-2" key={group.state}>
            <span className="text-ink-muted">{group.state}</span>
            {group.items.slice(0, namedDifferences).map((item) => (
              <button
                className={`font-semibold ${linkClass}`}
                key={item.source.id}
                onClick={() => open(item)}
              >
                {item.source.name}
              </button>
            ))}
            {more > 0 ? (
              <span className="text-ink-faint">+{more} more</span>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

function Findings({
  project,
  tool,
  onOpenProject
}: Pick<RowProps, "project" | "tool" | "onOpenProject">) {
  const findings = (project.findings ?? []).filter(
    (finding) => finding.tool === tool
  );
  if (!findings.length) {
    return <span className="text-ink-faint">None</span>;
  }
  return (
    <button
      className={linkClass}
      onClick={() => onOpenProject(project.path, { view: "findings" })}
    >
      <FindingCounts findings={findings} />
    </button>
  );
}

function Scanned(props: RowProps) {
  const { project } = props;
  const startup = startupTokens(project, props.tool);
  const own = projectOwn(project, props.showInactive);
  return (
    <>
      <td className="tabular-nums">
        {startup === undefined ? "–" : approxTokens(startup)}
      </td>
      <td>
        {own.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {own.map(([kind, count]) => (
              <button
                className={`inline-flex items-center gap-1 whitespace-nowrap ${linkClass}`}
                key={kind}
                onClick={() =>
                  props.onOpenProject(project.path, { view: "inventory", kind })
                }
              >
                <KindIcon kind={kind} small />
                <span className="tabular-nums">{count}</span>
                {count === 1 ? kindSingular[kind] : kindLabel[kind]}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-ink-faint">Nothing of its own</span>
        )}
      </td>
      <td>
        <Differences
          groups={differencesFromGlobal(props.globalRecords, project)}
          onOpenProject={props.onOpenProject}
          onSelect={props.onSelect}
          project={project}
        />
      </td>
      <td>
        <Findings
          onOpenProject={props.onOpenProject}
          project={project}
          tool={props.tool}
        />
      </td>
    </>
  );
}

/**
 * A row never claims results for a project that is still scanning or failed to scan. While a project rescans,
 * its previous results stay in place, faded, so the table does not blank out; a previous error reads as scanning.
 */
function ProjectRow(props: RowProps & { context: PathContext }) {
  const { project } = props;
  const pending = () =>
    scanFailed(project) ? (
      <td className="text-problem" colSpan={4}>
        Scan failed: {project.error} Rescan to try again.
      </td>
    ) : (
      <td className="text-ink-faint" colSpan={4}>
        {project.refreshing ? "Rescanning…" : "Scanning…"}
      </td>
    );
  return (
    <tr
      aria-busy={project.refreshing || undefined}
      className={project.refreshing && project.records ? "opacity-40" : ""}
    >
      <th className="text-left font-normal" scope="row">
        <button
          className={`block max-w-full truncate font-semibold ${linkClass}`}
          onClick={() => props.onOpenProject(project.path)}
        >
          {project.name}
        </button>
        <span className="block truncate font-mono text-mono text-ink-faint">
          {tildePath(project.path, props.context)}
        </span>
      </th>
      {project.records ? <Scanned {...props} /> : pending()}
    </tr>
  );
}

const columns = [
  ["Project", "w-[22%]"],
  ["Startup", "w-[76px]"],
  ["Adds", "w-[26%]"],
  ["Differs from global", ""],
  ["Findings", "w-[124px]"]
] as const;

/** Every project on one row: what it costs to start, what it adds, and where it departs from the global setup. */
export function ProjectsView(props: ProjectsViewProps) {
  return (
    <div className="px-5 pt-4 pb-10">
      {props.summary}
      {props.projects.length ? (
        <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-label [&_td]:border-t [&_td]:border-wash [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tbody_th]:border-t [&_tbody_th]:border-wash [&_tbody_th]:px-3 [&_tbody_th]:py-2.5 [&_tbody_th]:align-top">
            <caption className="sr-only">
              Projects compared with the global configuration
            </caption>
            <thead>
              <tr>
                {columns.map(([label, width]) => (
                  <th
                    className={`h-9 px-3 text-left text-caption font-semibold text-ink-muted ${width}`}
                    key={label}
                    scope="col"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.projects.map((project) => (
                <ProjectRow
                  context={props.context}
                  globalRecords={props.globalRecords}
                  key={project.path}
                  onOpenProject={props.onOpenProject}
                  onSelect={props.onSelect}
                  project={project}
                  showInactive={props.showInactive}
                  tool={props.tool}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No projects yet">
          Add a folder in the sidebar to see what each project loads.
        </EmptyState>
      )}
    </div>
  );
}
