import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { layerHint } from "../model/layers";
import { tildePath } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import {
  CoverageInspector,
  InspectorEmpty,
  RecordInspector
} from "../inspector/inspector";
import type { HeaderTitle } from "../shell/header";
import type { ViewTab } from "../shell/view-bar";
import { toolName } from "../ui/marks";
import { FindingsView } from "../views/findings-view";
import { InventoryView } from "../views/inventory-view";
import { MapView } from "../views/map/map-view";
import type { ReachProject } from "../views/reach/reach-model";
import { ReachView } from "../views/reach/reach-view";
import { relevantDifferences } from "../views/worktrees/difference-groups";
import { WorktreeView } from "../views/worktrees/worktree-view";
import type { WorkspaceState } from "./use-workspace";

export interface WorkspaceProps {
  snapshot: InventorySnapshot;
  isProject: boolean;
  tool: ToolId;
  refreshing: boolean;
  refreshKey: number;
  projectPaths: string[];
  initialSelectedId?: string;
  notice?: string;
  onTool(tool: ToolId): void;
  onRescan(): void;
  onSelectPath(path: string, selectId?: string): void;
}

export interface PartsProps {
  props: WorkspaceProps;
  state: WorkspaceState;
  /** Other projects' inventories, scanned only for the Global view. */
  reach: ReachProject[];
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
    return [{ id: "reach", label: "Reach" }, inventory, findings];
  }
  const linked = props.snapshot.worktrees.filter((tree) => !tree.isMain).length;
  const worktrees: ViewTab[] =
    linked || props.snapshot.comparison
      ? [
          {
            id: "worktrees",
            label: "Worktrees",
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
  return [{ id: "map", label: "Map" }, inventory, findings, ...worktrees];
}

export function titleFor({ props, state }: PartsProps): HeaderTitle {
  if (!props.isProject) {
    return {
      name: "Global",
      subtitle: "How your global configuration reaches each project"
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
  if (state.view === "map") {
    return (
      <MapView
        {...common}
        estimate={props.snapshot.context}
        onKind={state.filterKind}
        onSelect={state.select}
        onToggleInactive={state.toggleInactive}
        records={state.toolRecords}
        showInactive={state.showInactive}
        tool={props.tool}
      />
    );
  }
  if (state.view === "reach") {
    return (
      <ReachView
        {...common}
        globalRecords={state.toolRecords}
        onOpenProject={(path) => props.onSelectPath(path)}
        onSelect={(record: InventoryRecord) =>
          state.select(record.id, { reveal: false })
        }
        projects={reach}
        showInactive={state.showInactive}
        tool={props.tool}
      />
    );
  }
  if (state.view === "worktrees") {
    return (
      <WorktreeView
        comparison={props.snapshot.comparison}
        onSelectPath={props.onSelectPath}
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
      kind={state.kind}
      onKind={state.filterKind}
      onSelect={state.select}
      records={state.visible}
    />
  );
}

export function Inspector({ props, state, reach }: PartsProps) {
  if (state.showCoverage) {
    return <CoverageInspector notes={props.snapshot.coverage} />;
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
    imports: props.snapshot.imports,
    context: state.context,
    workingDirectory: props.snapshot.workingDirectory
  };
  return (
    <RecordInspector
      key={state.selected.id}
      onKind={state.filterKind}
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
