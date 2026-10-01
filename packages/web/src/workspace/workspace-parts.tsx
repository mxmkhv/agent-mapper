import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { layerHint } from "../model/layers";
import { tildePath } from "../model/paths";
import { relationLabels } from "../model/precedence";
import type { InventoryRecord } from "../model/record-types";
import type { ScannedProject } from "../model/scanned-project";
import { CoverageInspector } from "../inspector/coverage-inspector";
import { InspectorEmpty, RecordInspector } from "../inspector/inspector";
import type { HeaderTitle } from "../shell/header";
import type { Landing, ViewTab } from "../shell/view-bar";
import { toolName } from "../ui/marks";
import { FindingsView } from "../views/findings-view";
import { InventoryView } from "../views/inventory-view";
import { ProjectsView } from "../views/projects/projects-view";
import { StartupSummary } from "../views/startup-summary";
import { relevantDifferences } from "../views/worktrees/difference-groups";
import { WorktreeView } from "../views/worktrees/worktree-view";
import type { CopyTarget } from "../model/copy-targets";
import type { WorkspaceState } from "./use-workspace";

export interface WorkspaceProps {
  snapshot: InventorySnapshot;
  isProject: boolean;
  tool: ToolId;
  refreshing: boolean;
  refreshKey: number;
  projectPaths: string[];
  /** Folders a skill can be copied into, worktrees included. */
  copyTargets: CopyTarget[];
  landing?: Landing;
  notice?: string;
  onTool(tool: ToolId): void;
  onRescan(): void;
  onSelectPath(path: string, landing?: Landing): void;
}

export interface PartsProps {
  props: WorkspaceProps;
  state: WorkspaceState;
  /** Other projects' inventories, scanned only for the Global view. */
  reach: ScannedProject[];
}

export function tabsFor({ props, state }: PartsProps): ViewTab[] {
  const findings: ViewTab = {
    id: "findings",
    label: "Findings",
    count: state.findings.length,
    alert: state.findings.some((finding) => finding.level === "problem")
  };
  const inventory: ViewTab = {
    id: "inventory",
    label: "Inventory",
    count: state.visible.length
  };
  if (!props.isProject) {
    return [
      { id: "projects", label: "Projects", count: props.projectPaths.length },
      inventory,
      findings
    ];
  }
  const linked = props.snapshot.worktrees.filter((tree) => !tree.isMain).length;
  const worktrees: ViewTab[] =
    linked || props.snapshot.comparison
      ? [
          {
            id: "worktrees",
            // A linked checkout shows its differences from the main checkout here, counted in files.
            label: props.snapshot.comparison ? "Differences" : "Worktrees",
            count:
              (props.snapshot.comparison &&
                relevantDifferences(
                  props.snapshot.comparison.differences,
                  props.tool
                ).length) ??
              linked
          }
        ]
      : [];
  return [inventory, findings, ...worktrees];
}

export function titleFor({ props, state }: PartsProps): HeaderTitle {
  if (!props.isProject) {
    return {
      name: "Global",
      subtitle: "Your global configuration and how each project builds on it"
    };
  }
  const path = props.snapshot.workingDirectory;
  return {
    name: path.split("/").at(-1) ?? path,
    path: tildePath(path, state.context),
    branch: props.snapshot.worktrees.find((tree) => tree.path === path)?.branch
  };
}

export function Content({ props, state, reach }: PartsProps) {
  const common = { context: state.context, selectedId: state.selected?.id };
  if (state.view === "findings") {
    return (
      <FindingsView
        context={state.context}
        findings={state.findings}
        onSelect={state.select}
        toolName={toolName[props.tool]}
      />
    );
  }
  const summary = (title: string, withFindings: boolean) => (
    <StartupSummary
      {...common}
      estimate={props.snapshot.context[props.tool]}
      findings={
        withFindings
          ? { list: state.findings, onOpen: () => state.setView("findings") }
          : undefined
      }
      onSelect={(id) => state.select(id, { reveal: props.isProject })}
      records={state.toolRecords}
      title={title}
      tool={props.tool}
    />
  );
  if (state.view === "projects") {
    return (
      <ProjectsView
        context={state.context}
        globalRecords={state.toolRecords}
        onOpenProject={props.onSelectPath}
        onSelect={(record: InventoryRecord) =>
          state.select(record.id, { reveal: false })
        }
        projects={reach}
        showInactive={state.showInactive}
        summary={summary("Every project starts with", false)}
        tool={props.tool}
      />
    );
  }
  if (state.view === "worktrees") {
    return (
      <WorktreeView
        comparison={props.snapshot.comparison}
        context={state.context}
        onRemoved={props.onRescan}
        onSelectPath={props.onSelectPath}
        refreshKey={props.refreshKey}
        tool={props.tool}
        workingDirectory={props.snapshot.workingDirectory}
        worktrees={props.snapshot.worktrees}
      />
    );
  }
  return (
    <InventoryView
      {...common}
      hintFor={(group) =>
        group.layer === "plugins"
          ? undefined
          : layerHint(group.layer, {
              records: state.toolRecords,
              context: state.context,
              tool: props.tool
            })
      }
      groupFocus={state.groupFocus}
      onGroupFocused={state.groupFocused}
      isProject={props.isProject}
      kind={state.kind}
      onKind={state.filterKind}
      onOpenDocument={state.openDocument}
      onSelect={state.select}
      otherVersions={state.showInactive ? undefined : state.otherVersions}
      records={state.visible}
      relations={relationLabels({
        records: state.toolRecords,
        findings: state.findings
      })}
      revealRequest={state.revealRequest}
      summary={
        props.isProject ? summary("A new session starts with", true) : undefined
      }
      tool={props.tool}
      transfer={{
        workingDirectory: props.snapshot.workingDirectory,
        scannedAt: props.snapshot.scannedAt,
        copyTargets: props.copyTargets
      }}
    />
  );
}

export function Inspector({ props, state, reach }: PartsProps) {
  if (state.showCoverage) {
    return (
      <CoverageInspector
        context={state.context}
        notes={props.snapshot.coverage}
      />
    );
  }
  if (!state.selected) {
    return (
      <InspectorEmpty
        active={state.toolRecords.length - state.inactiveCount}
        inactive={state.inactiveCount}
        tool={toolName[props.tool]}
      />
    );
  }
  const scope = {
    records: state.lookup,
    findings: state.findings,
    imports: props.snapshot.imports,
    context: state.context,
    workingDirectory: props.snapshot.workingDirectory,
    scannedAt: props.snapshot.scannedAt,
    copyTargets: props.copyTargets
  };
  return (
    <RecordInspector
      key={state.selected.id}
      onKind={state.filterKind}
      onOpenDocument={state.openDocument}
      onSelect={state.select}
      reach={
        props.isProject
          ? undefined
          : { projects: reach, onOpen: props.onSelectPath }
      }
      record={state.selected}
      scope={scope}
    />
  );
}
