import { useState, type ReactNode } from "react";
import type { ToolId } from "@agent-mapper/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isLink } from "../../model/links";
import { tildePath, type PathContext } from "../../model/paths";
import type { InventoryRecord } from "../../model/record-types";
import type { Landing } from "../../shell/view-bar";
import { stateText } from "../../model/states";
import { KindIcon, kindLabel } from "../../ui/kind-icon";
import { StateMarker, SymlinkBadge } from "../../ui/marks";
import { PathLine } from "../../ui/path-line";
import {
  scanSettled,
  type buildReach,
  type ReachProject,
  type ReachRow
} from "./reach-model";

/** How many names preview a collapsed "reach every project" row. */
const previewNames = 4;

export interface ReachViewProps {
  globalRecords: InventoryRecord[];
  projects: ReachProject[];
  tool: ToolId;
  context: PathContext;
  showInactive: boolean;
  selectedId?: string;
  onSelect(record: InventoryRecord): void;
  onOpenProject(path: string, landing?: Landing): void;
}

/**
 * Column cells never claim a result for a project that is still scanning or failed to scan. While a project
 * rescans, its previous records stay in place, faded, so the table does not blank out; a previous error
 * shows as scanning.
 */
export function ScanCell({
  project,
  children
}: {
  project: ReachProject;
  children: ReactNode;
}) {
  if (project.refreshing) {
    return (
      <td className="text-center opacity-40" title="Rescanning">
        {project.records ? (
          children
        ) : (
          <span className="text-caption text-ink-faint">…</span>
        )}
      </td>
    );
  }
  if (project.error) {
    return (
      <td
        className="text-center text-caption text-problem"
        title={project.error}
      >
        scan failed
      </td>
    );
  }
  if (!project.records) {
    return (
      <td className="text-center text-caption text-ink-faint" title="Scanning">
        …
      </td>
    );
  }
  return <td className="text-center">{children}</td>;
}

/** The source column stays pinned while project columns scroll sideways. */
export const stickySource =
  "sticky left-0 z-[1] px-3 shadow-[1px_0_0_var(--am-hairline)]";

function Cell({
  record,
  project
}: {
  record?: InventoryRecord;
  project: ReachProject;
}) {
  return (
    <ScanCell project={project}>
      {record ? (
        <span
          className="inline-grid size-[22px] place-items-center"
          title={stateText(record)}
        >
          <StateMarker large tier={record.tier} />
        </span>
      ) : (
        <span
          aria-label="Does not reach"
          className="inline-block h-[1.5px] w-2.5 rounded-full bg-hairline-strong align-middle"
          title="Does not reach this project"
        />
      )}
    </ScanCell>
  );
}

function SourceRow({ row, props }: { row: ReachRow; props: ReachViewProps }) {
  const { record } = row;
  const selected = record.id === props.selectedId;
  return (
    <tr
      className={`group cursor-pointer ${selected ? "bg-selected" : "hover:bg-hover"}`}
      onClick={() => props.onSelect(record)}
    >
      <td
        className={`${stickySource} ${selected ? "bg-selected" : "bg-surface group-hover:bg-hover"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`font-semibold whitespace-nowrap ${record.tier === "inactive" ? "text-ink-muted" : ""}`}
          >
            {record.name}
          </span>
          {isLink(record) ? (
            <SymlinkBadge target={tildePath(record.realPath, props.context)} />
          ) : null}
          {record.kind === "plugin" ? (
            <span className="font-mono text-mono text-ink-faint">
              {record.summary}
            </span>
          ) : (
            <PathLine path={tildePath(record.path, props.context)} />
          )}
        </span>
      </td>
      {row.cells.map((cell, index) => {
        const project = props.projects[index];
        return project ? (
          <Cell key={project.path} project={project} record={cell} />
        ) : null;
      })}
    </tr>
  );
}

/**
 * Rows that apply everywhere draw one cell instead of a dot per project, once every scan has succeeded.
 * While any project is scanning or failed, each column keeps its own cell so no result is claimed for it.
 */
function UniformCells({ projects }: { projects: ReachProject[] }) {
  const settled = projects.every(scanSettled);
  if (!settled) {
    return projects.map((project) => (
      <ScanCell key={project.path} project={project}>
        <StateMarker large tier="active" />
      </ScanCell>
    ));
  }
  return (
    <td
      className="text-center text-caption text-ink-muted"
      colSpan={projects.length}
    >
      {projects.length === 1
        ? "the only project"
        : `all ${projects.length} projects`}
    </td>
  );
}

export function SectionRows({
  section,
  props
}: {
  section: ReturnType<typeof buildReach>[number];
  props: ReachViewProps;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;
  const names = section.uniform
    .slice(0, previewNames)
    .map((row) => row.record.name)
    .join(", ");
  return (
    <>
      <tr className="bg-wash">
        <td
          className="h-[30px] px-3 text-caption font-semibold text-ink-muted"
          colSpan={props.projects.length + 1}
        >
          <span className="sticky left-3 inline-flex items-center gap-1.5">
            <KindIcon kind={section.kind} small />
            {kindLabel[section.kind]} ·{" "}
            {section.varying.length + section.uniform.length}
          </span>
        </td>
      </tr>
      {section.varying.map((row) => (
        <SourceRow key={row.record.id} props={props} row={row} />
      ))}
      {section.uniform.length ? (
        <tr
          className="group cursor-pointer text-ink-muted hover:bg-hover"
          onClick={() => setOpen(!open)}
        >
          <td className={`${stickySource} bg-surface group-hover:bg-hover`}>
            <span className="flex min-w-0 items-center gap-2">
              <Chevron
                aria-hidden="true"
                className="size-3.5 shrink-0 text-ink-faint"
                strokeWidth={1.8}
              />
              <span className="whitespace-nowrap">
                {section.uniform.length}{" "}
                {section.uniform.length === 1 ? "reaches" : "reach"} every
                project
              </span>
              <span className="truncate text-ink-faint">
                {names}
                {section.uniform.length > previewNames ? "…" : ""}
              </span>
            </span>
          </td>
          <UniformCells projects={props.projects} />
        </tr>
      ) : null}
      {open
        ? section.uniform.map((row) => (
            <SourceRow key={row.record.id} props={props} row={row} />
          ))
        : null}
    </>
  );
}
