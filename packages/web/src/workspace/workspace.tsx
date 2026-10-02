import { useMemo } from "react";
import { DocumentWorkspace } from "../documents/document-workspace";
import { DraftsMenu } from "../documents/drafts-menu";
import type { ImpactCoverage } from "../documents/impact-summary";
import { Button } from "../ui/button";
import { PixelIcon } from "../ui/pixel-icon";
import { Header } from "../shell/header";
import { ViewBar } from "../shell/view-bar";
import { useProjectSnapshots } from "../state/use-project-snapshots";
import { toolName } from "../ui/marks";
import {
  scanFailed,
  scanPending,
  scanSettled,
  type ScannedProject
} from "../model/scanned-project";
import { SearchPalette } from "../views/search-palette";
import { useWorkspace } from "./use-workspace";
import {
  Content,
  Inspector,
  tabsFor,
  titleFor,
  type WorkspaceProps
} from "./workspace-parts";

/** What a document review may claim about other folders, given which scans have finished. */
function impactCoverage(
  props: WorkspaceProps,
  scanned: ScannedProject[]
): ImpactCoverage {
  if (props.isProject) {
    return {
      mode: "project",
      workingDirectory: props.snapshot.workingDirectory
    };
  }
  return {
    mode: "global",
    total: scanned.length,
    scanned: scanned.filter(scanSettled).length,
    pending: scanned.filter(scanPending).length,
    failed: scanned.filter(scanFailed).length
  };
}

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
  const forTool = scanned.map((project) => ({
    ...project,
    records: project.records?.filter(
      (record) => record.tool === props.tool || record.tool === "unknown"
    )
  }));
  const parts = { props, state, scanned: forTool };
  const coverage = impactCoverage(props, scanned);
  const tabs = tabsFor(parts);
  const detailOpen = Boolean(state.selected ?? state.showCoverage);
  // The Projects table needs the width, so its inspector appears only with something to show.
  const withInspector =
    state.view !== "worktrees" && (state.view !== "projects" || detailOpen);
  const viewLabel =
    tabs.find((tab) => tab.id === state.view)?.label ?? "inventory";
  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)]">
      <Header
        actions={
          <DraftsMenu
            context={state.context}
            onOpen={(sourceKey) => state.openDocument(sourceKey, "edit")}
          />
        }
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
        tabs={tabs}
        view={state.view}
      />
      {props.notice ? (
        <p
          className="m-0 border-b-2 border-problem px-5 py-2 text-label font-semibold text-problem"
          role="alert"
        >
          {props.notice}
        </p>
      ) : (
        <span />
      )}
      <div className="relative grid min-h-0">
        {/* While a document is open the browsing grid stays mounted, hidden and inert, keeping its scroll and selection. */}
        <div
          className={`relative grid min-h-0 ${withInspector ? "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]" : ""} ${state.documentView ? "invisible" : ""}`}
          inert={Boolean(state.documentView)}
        >
          {/* Keyed by view so switching views starts at the top instead of the previous view's scroll offset. */}
          <div className="min-h-0 overflow-auto" key={state.view}>
            <Content {...parts} />
          </div>
          {withInspector ? (
            // Below 1024px the inspector floats over the content, and only while it has something to show.
            <aside
              aria-label="Inspector"
              className={`min-h-0 overflow-auto border-l-2 border-rule bg-surface max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:w-[min(380px,calc(100%-40px))] max-lg:border-ink ${detailOpen ? "" : "max-lg:hidden"}`}
            >
              {detailOpen ? (
                <Button
                  aria-label="Close inspector"
                  className="absolute top-3 right-3 lg:hidden"
                  onClick={state.closeInspector}
                  variant="icon"
                >
                  <PixelIcon name="close" />
                </Button>
              ) : null}
              <Inspector {...parts} />
            </aside>
          ) : null}
        </div>
        {state.documentView ? (
          <div className="absolute inset-0 z-30 min-h-0">
            <DocumentWorkspace
              backTo={viewLabel.toLocaleLowerCase()}
              context={state.context}
              coverage={coverage}
              key={state.documentView.sourceKey}
              mode={state.documentView.mode}
              onBack={state.closeDocument}
              onMode={state.setDocumentMode}
              onOpen={(sourceKey) => state.openDocument(sourceKey, "edit")}
              sourceKey={state.documentView.sourceKey}
            />
          </div>
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
