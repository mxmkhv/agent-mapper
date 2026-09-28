import { useMemo } from "react";
import { Header } from "../shell/header";
import { ViewBar } from "../shell/view-bar";
import { useProjectSnapshots } from "../state/use-project-snapshots";
import { toolName } from "../ui/marks";
import { SearchPalette } from "../views/search-palette";
import { useWorkspace } from "./use-workspace";
import {
  Content,
  Inspector,
  tabsFor,
  titleFor,
  type WorkspaceProps
} from "./workspace-parts";

export function Workspace(props: WorkspaceProps) {
  const scanned = useProjectSnapshots(
    props.isProject ? [] : props.projectPaths,
    props.refreshKey
  );
  const extraRecords = useMemo(
    () => scanned.flatMap((project) => project.records ?? []),
    [scanned]
  );
  const state = useWorkspace({ ...props, extraRecords });
  const reach = scanned.map((project) => ({
    ...project,
    records: project.records?.filter(
      (record) => record.tool === props.tool || record.tool === "unknown"
    )
  }));
  const parts = { props, state, reach };
  const withInspector = state.view !== "worktrees";
  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)]">
      <Header
        onRescan={props.onRescan}
        onSearch={() => state.setSearchOpen(true)}
        onTool={props.onTool}
        refreshing={props.refreshing}
        scannedAt={props.snapshot.scannedAt}
        title={titleFor(parts)}
        tool={props.tool}
      />
      <ViewBar
        coverageCount={props.snapshot.coverage.length}
        inactiveCount={state.inactiveCount}
        onCoverage={state.toggleCoverage}
        onToggleInactive={state.toggleInactive}
        onView={state.setView}
        showInactive={state.showInactive}
        tabs={tabsFor(parts)}
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
          <Content {...parts} />
        </div>
        {withInspector ? (
          <aside
            aria-label="Inspector"
            className="min-h-0 overflow-auto border-l border-hairline bg-surface"
          >
            <Inspector {...parts} />
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
