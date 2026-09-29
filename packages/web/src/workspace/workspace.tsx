import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
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
  const detailOpen = Boolean(state.selected ?? state.showCoverage);
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
        className={`relative grid min-h-0 ${withInspector ? "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}
      >
        {/* Keyed by view so switching views starts at the top instead of the previous view's scroll offset. */}
        <div className="min-h-0 overflow-auto" key={state.view}>
          <Content {...parts} />
        </div>
        {withInspector ? (
          // Below 1024px the inspector floats over the content, and only while it has something to show.
          <aside
            aria-label="Inspector"
            className={`min-h-0 overflow-auto border-l border-hairline bg-surface max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:w-[min(380px,calc(100%-40px))] max-lg:shadow-dialog ${detailOpen ? "" : "max-lg:hidden"}`}
          >
            {detailOpen ? (
              <Button
                aria-label="Close inspector"
                className="absolute top-3 right-3 lg:hidden"
                onClick={state.closeInspector}
                variant="icon"
              >
                <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
              </Button>
            ) : null}
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
