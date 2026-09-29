import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { layerHint } from "../model/layers";
import { tildePath } from "../model/paths";
import {
  CoverageInspector,
  InspectorEmpty,
  RecordInspector
} from "../inspector/inspector";
import { Header, type HeaderTitle } from "../shell/header";
import { ViewBar, type ViewTab } from "../shell/view-bar";
import { toolName } from "../ui/marks";
import { FindingsView } from "../views/findings-view";
import { InventoryView } from "../views/inventory-view";
import { SearchPalette } from "../views/search-palette";
import { WorktreePanel } from "../worktree-panel";
import { useWorkspace, type WorkspaceState } from "./use-workspace";

interface WorkspaceProps {
  snapshot: InventorySnapshot;
  isProject: boolean;
  tool: ToolId;
  refreshing: boolean;
  notice?: string;
  onTool(tool: ToolId): void;
  onRescan(): void;
  onSelectPath(path: string): void;
}

function tabsFor(props: WorkspaceProps, state: WorkspaceState): ViewTab[] {
  const tabs: ViewTab[] = [
    { id: "inventory", label: "Inventory", count: state.visible.length },
    {
      id: "findings",
      label: "Findings",
      count: state.findings.length,
      alert: state.findings.some((finding) => finding.level === "problem")
    }
  ];
  const linked = props.snapshot.worktrees.filter((tree) => !tree.isMain).length;
  if (props.isProject && (linked || props.snapshot.comparison)) {
    tabs.push({
      id: "worktrees",
      label: "Worktrees",
      count: props.snapshot.comparison?.differences.length ?? linked
    });
  }
  return tabs;
}

function titleFor(
  { snapshot, isProject }: WorkspaceProps,
  state: WorkspaceState
): HeaderTitle {
  if (!isProject) {
    return {
      name: "Global",
      subtitle: "How your global configuration reaches each project"
    };
  }
  const path = snapshot.workingDirectory;
  return {
    name: path.split("/").at(-1) ?? path,
    path: tildePath(path, state.context),
    branch: snapshot.worktrees.find((tree) => tree.path === path)?.branch
  };
}

function Content({
  props,
  state
}: {
  props: WorkspaceProps;
  state: WorkspaceState;
}) {
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
  if (state.view === "worktrees") {
    return (
      <div className="inventory-grid m-5">
        <WorktreePanel
          comparison={props.snapshot.comparison}
          onSelectPath={props.onSelectPath}
          tool={props.tool}
          workingDirectory={props.snapshot.workingDirectory}
          worktrees={props.snapshot.worktrees}
        />
      </div>
    );
  }
  return (
    <InventoryView
      context={state.context}
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
      selectedId={state.selected?.id}
    />
  );
}

function Inspector({
  props,
  state
}: {
  props: WorkspaceProps;
  state: WorkspaceState;
}) {
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
    records: state.records,
    imports: props.snapshot.imports,
    context: state.context,
    workingDirectory: props.snapshot.workingDirectory
  };
  return (
    <RecordInspector
      key={state.selected.id}
      onKind={state.filterKind}
      onSelect={state.select}
      record={state.selected}
      scope={scope}
    />
  );
}

export function Workspace(props: WorkspaceProps) {
  const state = useWorkspace(props);
  const withInspector = state.view !== "worktrees";
  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)]">
      <Header
        onRescan={props.onRescan}
        onSearch={() => state.setSearchOpen(true)}
        onTool={props.onTool}
        refreshing={props.refreshing}
        scannedAt={props.snapshot.scannedAt}
        title={titleFor(props, state)}
        tool={props.tool}
      />
      <ViewBar
        coverageCount={props.snapshot.coverage.length}
        inactiveCount={state.inactiveCount}
        onCoverage={state.toggleCoverage}
        onToggleInactive={state.toggleInactive}
        onView={state.setView}
        showInactive={state.showInactive}
        tabs={tabsFor(props, state)}
        view={state.view}
      />
      {props.notice ? (
        <p
          className="m-0 border-b border-hairline bg-problem-wash px-5 py-2 text-label text-problem"
          role="alert"
        >
          {props.notice}
        </p>
      ) : (
        <span />
      )}
      <div
        className={`grid min-h-0 ${withInspector ? "grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}
      >
        <div className="min-h-0 overflow-auto">
          <Content props={props} state={state} />
        </div>
        {withInspector ? (
          <aside
            className="min-h-0 overflow-auto border-l border-hairline bg-surface"
            aria-label="Inspector"
          >
            <Inspector props={props} state={state} />
          </aside>
        ) : null}
      </div>
      {state.searchOpen ? (
        <SearchPalette
          context={state.context}
          onClose={() => state.setSearchOpen(false)}
          onPick={state.select}
          records={state.toolRecords}
          toolName={toolName[props.tool]}
        />
      ) : null}
    </div>
  );
}
