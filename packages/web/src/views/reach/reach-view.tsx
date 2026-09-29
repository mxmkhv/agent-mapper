import type { ReactNode } from "react";
import { Folder } from "lucide-react";
import { KindIcon, kindLabel } from "../../ui/kind-icon";
import { StateMarker, toolName } from "../../ui/marks";
import { tildePath } from "../../model/paths";
import {
  buildReach,
  projectOwn,
  skillReach,
  type ReachProject
} from "./reach-model";
import {
  ScanCell,
  SectionRows,
  stickySource,
  type ReachViewProps
} from "./reach-rows";
import { useHiddenColumns } from "./use-hidden-columns";

function CountRow({
  label,
  icon,
  counts,
  projects,
  total
}: {
  label: string;
  icon: ReactNode;
  counts: number[];
  projects: ReachProject[];
  total?: number;
}) {
  return (
    <tr>
      <td className={`${stickySource} bg-surface`}>
        <span className="flex items-center gap-2 font-semibold">
          {icon}
          {label}
        </span>
      </td>
      {projects.map((project, index) => {
        const count = counts[index] ?? 0;
        return (
          <ScanCell key={project.path} project={project}>
            <span
              className={`text-label tabular-nums ${count ? "" : "text-ink-faint"}`}
            >
              {total === undefined ? count || "–" : `${count}/${total}`}
            </span>
          </ScanCell>
        );
      })}
    </tr>
  );
}

/** The source column keeps room for a name and path; project columns scroll sideways when there are many. */
const sourceWidth = 300;
const projectWidth = 104;

export function ReachView(props: ReachViewProps) {
  const sections = buildReach(props.globalRecords, {
    projects: props.projects,
    showInactive: props.showInactive
  });
  const skills = skillReach(props.globalRecords, props.projects);
  const own = projectOwn(props.projects, props.showInactive);
  const scanning = props.projects.filter(
    (project) => !project.records && !project.error
  ).length;
  const columnCount = props.projects.length + 1;
  const { ref: tableRef, hidden: moreColumns } =
    useHiddenColumns<HTMLDivElement>();
  return (
    <div className="px-5 pt-4 pb-10">
      <p className="mt-0 mb-3.5 max-w-[720px] text-ink-muted">
        Each row is a {toolName[props.tool]} source outside your projects.
        Columns show whether it reaches that project.
        {scanning
          ? ` Scanning ${scanning} ${scanning === 1 ? "project" : "projects"}…`
          : ""}
      </p>
      <div className="relative">
        {/* The table scrolls in both directions itself so the header and source column can stay pinned. */}
        <div
          className="max-h-[calc(100vh-220px)] overflow-auto rounded-card border border-hairline bg-surface"
          ref={tableRef}
        >
          <table
            className="w-full table-fixed border-separate border-spacing-0 [&_td]:h-[34px] [&_td]:border-b [&_td]:border-wash"
            style={{
              minWidth: sourceWidth + props.projects.length * projectWidth
            }}
          >
            <colgroup>
              <col />
              {props.projects.map((project) => (
                <col key={project.path} style={{ width: projectWidth }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 h-11 border-b border-hairline bg-surface px-3 text-left text-label font-semibold shadow-[1px_0_0_var(--am-hairline)]">
                  Source
                </th>
                {props.projects.map((project) => (
                  <th
                    className="sticky top-0 z-10 h-11 truncate border-b border-hairline bg-surface px-2 text-label font-semibold"
                    key={project.path}
                    title={tildePath(project.path, props.context)}
                  >
                    <button
                      className="max-w-full truncate hover:underline"
                      onClick={() => props.onOpenProject(project.path)}
                    >
                      {project.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <SectionRows
                  key={section.kind}
                  props={props}
                  section={section}
                />
              ))}
              {skills.total ? (
                <>
                  <tr className="bg-wash">
                    <td
                      className="h-[30px] px-3 text-caption font-semibold text-ink-muted"
                      colSpan={columnCount}
                    >
                      <span className="sticky left-3 inline-flex items-center gap-1.5">
                        <KindIcon kind="skill" small />
                        Global skills
                      </span>
                    </td>
                  </tr>
                  <CountRow
                    counts={skills.counts}
                    icon={<KindIcon kind="skill" small />}
                    projects={props.projects}
                    label={`${skills.total} skills`}
                    total={skills.total}
                  />
                </>
              ) : null}
              <tr className="bg-wash">
                <td
                  className="h-[30px] px-3 text-caption font-semibold text-ink-muted"
                  colSpan={columnCount}
                >
                  <span className="sticky left-3 inline-flex items-center gap-1.5">
                    <Folder
                      aria-hidden="true"
                      className="size-3.5"
                      strokeWidth={1.6}
                    />
                    Added by the project itself
                  </span>
                </td>
              </tr>
              {own.map((row) => (
                <CountRow
                  counts={row.counts}
                  icon={<KindIcon kind={row.kind} small />}
                  key={row.kind}
                  label={kindLabel[row.kind]}
                  projects={props.projects}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-px right-px w-12 rounded-r-card bg-linear-to-l from-surface to-transparent transition-opacity duration-200 ${moreColumns ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-label text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <StateMarker tier="active" />
          Applies
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StateMarker tier="inactive" />
          Not used or disabled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StateMarker tier="unknown" />
          Unknown or needs approval
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[1.5px] w-2.5 bg-hairline-strong" />
          Does not reach
        </span>
      </div>
    </div>
  );
}
