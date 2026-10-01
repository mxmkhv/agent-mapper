import { useState } from "react";
import { useInventory, useProjects } from "./data";
import { AppFailure } from "./documents/app-failure";
import { copyTargets } from "./model/copy-targets";
import { DocumentErrorBoundary } from "./documents/document-error-boundary";
import { Sidebar } from "./shell/sidebar";
import type { Landing } from "./shell/view-bar";
import { DraftStore } from "./state/draft-store";
import { DocumentsContext, useUnloadGuard } from "./state/use-document-drafts";
import { useHiddenProjects } from "./state/use-hidden-projects";
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
  const [landing, setLanding] = useState<Landing>();
  const [theme, setTheme] = useTheme();
  const [tool, setTool] = useTool();
  const [projectsRefresh, setProjectsRefresh] = useState(0);
  const projects = useProjects(projectsRefresh);
  const visibility = useHiddenProjects(projects.value, () =>
    setProjectsRefresh((value) => value + 1)
  );
  const inventory = useInventory(selectedPath, refresh);
  // Drafts sit above the per-folder Workspace so project switches and rescans keep them.
  const [drafts] = useState(() => new DraftStore());
  const [refreshAfterSave, setRefreshAfterSave] = useState(false);
  useUnloadGuard(drafts);
  const rescan = () => {
    setRefreshAfterSave(false);
    setRefresh((value) => value + 1);
    setProjectsRefresh((value) => value + 1);
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
  /** Opening a folder from another view can carry the item, or the view and kind filter, to show there. */
  function selectPath(path: string, next?: Landing) {
    setLanding(next);
    setSelectedPath(path);
    window.localStorage.setItem(folderKey, path);
  }
  return (
    <DocumentsContext value={documents}>
      <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] overflow-hidden lg:grid-cols-[232px_minmax(0,1fr)]">
        <Sidebar
          error={projects.error}
          hiddenProjects={visibility.hidden}
          loading={projects.loading && !projects.value}
          onSelect={selectPath}
          onSetHidden={visibility.setHidden}
          onTheme={setTheme}
          projects={visibility.projects}
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
                landing={landing}
                isProject={Boolean(selectedPath)}
                key={selectedPath || "global"}
                notice={inventory.error ? failedRescan : undefined}
                onRescan={rescan}
                onSelectPath={selectPath}
                onTool={setTool}
                projectPaths={visibility.projects.map(
                  (project) => project.path
                )}
                copyTargets={copyTargets(
                  visibility.projects,
                  selectedPath ? inventory.value.workingDirectory : undefined
                )}
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
