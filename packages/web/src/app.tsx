import { useState } from "react";
import { useInventory, useProjects } from "./data";
import { Sidebar } from "./sidebar";
import { Workspace } from "./workspace";

function initialTool() {
  const selected = new URLSearchParams(window.location.search).get("tools");
  return selected === "claude" || selected === "codex" ? selected : "all";
}

export function App() {
  const [selectedPath, setSelectedPath] = useState(
    () => window.localStorage.getItem("agent-mapper:selected-folder") ?? ""
  );
  const [refresh, setRefresh] = useState(0);
  const projects = useProjects();
  const inventory = useInventory(selectedPath, refresh);
  function selectPath(path: string) {
    setSelectedPath(path);
    window.localStorage.setItem("agent-mapper:selected-folder", path);
  }
  return (
    <div className="app-shell">
      <Sidebar
        projects={projects.value?.projects ?? []}
        selectedPath={selectedPath}
        onSelect={selectPath}
        loading={projects.loading}
        error={projects.error}
      />
      <main className="main-area">
        {inventory.loading ? (
          <output className="status-screen">
            Scanning {selectedPath || "global sources"}…
          </output>
        ) : null}
        {inventory.error ? (
          <div className="status-screen error" role="alert">
            <h2>Could not scan this folder</h2>
            <p>{inventory.error}</p>
            <button onClick={() => setRefresh((value) => value + 1)}>
              Try again
            </button>
          </div>
        ) : null}
        {inventory.value && !inventory.loading ? (
          <Workspace
            key={selectedPath || "global"}
            snapshot={inventory.value}
            globalView={!selectedPath}
            initialTool={initialTool()}
            onRescan={() => setRefresh((value) => value + 1)}
          />
        ) : null}
      </main>
    </div>
  );
}
