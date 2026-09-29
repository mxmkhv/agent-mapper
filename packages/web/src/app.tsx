import { useState } from "react";
import { useInventory, useProjects } from "./data";
import { AppFailure } from "./documents/app-failure";
import { DocumentErrorBoundary } from "./documents/document-error-boundary";
import { Sidebar } from "./shell/sidebar";
import { DraftStore } from "./state/draft-store";
import { DocumentsContext, useUnloadGuard } from "./state/use-document-drafts";
import { useTheme } from "./state/use-theme";
import { useTool } from "./state/use-tool";
import { Button } from "./ui/button";
import { Workspace } from "./workspace/workspace";

const folderKey = "agent-mapper:selected-folder";

export function App() {
  const [selectedPath, setSelectedPath] = useState(
    () => window.localStorage.getItem(folderKey) ?? ""
  );
  const [refresh, setRefresh] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<string>();
  const [theme, setTheme] = useTheme();
  const [tool, setTool] = useTool();
  const projects = useProjects();
  const inventory = useInventory(selectedPath, refresh);
  // Drafts sit above the per-folder Workspace so project switches and rescans keep them.
  const [drafts] = useState(() => new DraftStore());
  const [refreshAfterSave, setRefreshAfterSave] = useState(false);
  useUnloadGuard(drafts);
  const rescan = () => {
    setRefreshAfterSave(false);
    setRefresh((value) => value + 1);
  };
  const documents = {
    store: drafts,
    onMutated() {
      setRefreshAfterSave(true);
      setRefresh((value) => value + 1);
    }
  };
  const failedRescan = refreshAfterSave
    ? `Saved; inventory refresh failed: ${inventory.error}. Use Rescan to try again.`
    : `Could not rescan: ${inventory.error}`;
  /** Opening a project from Global reach can carry the item to select there. */
  function selectPath(path: string, selectId?: string) {
    setPendingSelection(selectId);
    setSelectedPath(path);
    window.localStorage.setItem(folderKey, path);
  }
  return (
    <DocumentsContext value={documents}>
      <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden lg:grid-cols-[232px_minmax(0,1fr)]">
        <Sidebar
          error={projects.error}
          loading={projects.loading}
          onSelect={selectPath}
          onTheme={setTheme}
          projects={projects.value?.projects ?? []}
          selectedPath={selectedPath}
          theme={theme}
        />
        <main className="grid min-h-0 min-w-0">
          <DocumentErrorBoundary
            fallback={(message) => (
              <AppFailure message={message} store={drafts} />
            )}
          >
            {inventory.value ? (
              <Workspace
                initialSelectedId={pendingSelection}
                isProject={Boolean(selectedPath)}
                key={selectedPath || "global"}
                notice={inventory.error ? failedRescan : undefined}
                onRescan={rescan}
                onSelectPath={selectPath}
                onTool={setTool}
                projectPaths={
                  projects.value?.projects.map((project) => project.path) ?? []
                }
                refreshKey={refresh}
                refreshing={inventory.loading}
                snapshot={inventory.value}
                tool={tool}
              />
            ) : (
              <div className="grid place-items-center p-10 text-center">
                {inventory.error ? (
                  <div role="alert">
                    <h2 className="text-headline font-semibold">
                      Could not scan this folder
                    </h2>
                    <p className="text-ink-muted">{inventory.error}</p>
                    <Button onClick={rescan}>Try again</Button>
                  </div>
                ) : (
                  <output className="text-ink-muted">
                    Scanning {selectedPath || "global sources"}…
                  </output>
                )}
              </div>
            )}
          </DocumentErrorBoundary>
        </main>
      </div>
    </DocumentsContext>
  );
}
