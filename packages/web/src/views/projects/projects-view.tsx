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
import { cellLinkClass, Differences } from "./differences";
import {
  differencesFromGlobal,
  projectOwn,
  startupTokens
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

function Findings({
  project,
  tool,
  onOpenProject
}: Pick<RowProps, "project" | "tool" | "onOpenProject">) {
  const findings = (project.findings ?? []).filter(
    (finding) => finding.tool === tool
  );
  if (!findings.length) {
    return <span className="text-ink-muted">None</span>;
  }
  return (
    <button
      className={cellLinkClass}
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
      <td className="font-mono text-mono">
        {startup === undefined ? "–" : approxTokens(startup)}
      </td>
      <td>
        {own.length ? (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {own.map(([kind, count]) => (
              <button
                className={`inline-flex items-center gap-1.5 whitespace-nowrap ${cellLinkClass}`}
                key={kind}
                onClick={() =>
                  props.onOpenProject(project.path, { view: "inventory", kind })
                }
              >
                <KindIcon kind={kind} />
                <span className="font-mono text-mono">{count}</span>
                {count === 1 ? kindSingular[kind] : kindLabel[kind]}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-ink-muted">Nothing of its own</span>
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
 * A row never presents results as current while its project is scanning, and claims none for a failed scan.
 * While a project rescans, its previous results stay in place, faded, so the table does not blank out; a
 * previous error reads as scanning.
 */
function ProjectRow(props: RowProps & { context: PathContext }) {
  const { project } = props;
  const pending = () =>
    scanFailed(project) ? (
      <td className="text-problem" colSpan={4}>
        {/* Scan errors already say what to do next; only a bare failure needs the hint. */}
        {project.error
          ? `Scan failed: ${project.error}`
          : "Scan failed. Rescan to try again."}
      </td>
    ) : (
      <td className="text-ink-muted" colSpan={4}>
        {project.refreshing ? "Rescanning…" : "Scanning…"}
      </td>
    );
  return (
    <tr
      aria-busy={project.refreshing || undefined}
      className={`hover:bg-wash ${project.refreshing && project.records ? "opacity-40" : ""}`}
    >
      <th className="text-left font-normal" scope="row">
        <button
          className={`block max-w-full truncate text-body font-semibold ${cellLinkClass}`}
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
        <div className="overflow-x-auto border-2 border-rule">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-label [&_tbody_tr+tr_td]:border-t [&_tbody_tr+tr_td]:border-dotted [&_tbody_tr+tr_td]:border-hairline [&_tbody_tr+tr_th]:border-t [&_tbody_tr+tr_th]:border-dotted [&_tbody_tr+tr_th]:border-hairline [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tbody_th]:px-3 [&_tbody_th]:py-2.5 [&_tbody_th]:align-top">
            <caption className="sr-only">
              Projects compared with the global configuration
            </caption>
            <thead>
              <tr className="bg-ink text-canvas">
                {columns.map(([label, width]) => (
                  <th
                    className={`h-[26px] px-3 text-left font-mono text-mono ${width}`}
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
