import { useState } from "react";
import type { ToolId } from "@agent-mapper/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isLink } from "../../model/links";
import { tildePath, type PathContext } from "../../model/paths";
import type { InventoryRecord } from "../../model/record-types";
import { stateText } from "../../model/states";
import { KindIcon, kindLabel } from "../../ui/kind-icon";
import { StateMarker, SymlinkBadge } from "../../ui/marks";
import { PathLine } from "../../ui/path-line";
import type { buildReach, ReachProject, ReachRow } from "./reach-model";

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
  onOpenProject(path: string): void;
}

function Cell({
  record,
  project
}: {
  record?: InventoryRecord;
  project: ReachProject;
}) {
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
    return <td className="text-center text-caption text-ink-faint">…</td>;
  }
  return (
    <td className="text-center">
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
    </td>
  );
}

function SourceRow({ row, props }: { row: ReachRow; props: ReachViewProps }) {
  const { record } = row;
  const selected = record.id === props.selectedId;
  return (
    <tr
      className={`cursor-pointer ${selected ? "bg-selected" : "hover:bg-hover"}`}
      onClick={() => props.onSelect(record)}
    >
      <td className="px-3">
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
          <span className="inline-flex items-center gap-1.5">
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
          className="cursor-pointer text-ink-muted hover:bg-hover"
          onClick={() => setOpen(!open)}
        >
          <td className="px-3">
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
          {props.projects.map((project) => (
            <td className="text-center" key={project.path}>
              <StateMarker large tier="active" />
            </td>
          ))}
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
