import { useState, type FormEvent } from "react";
import type { ProjectSuggestion } from "./api";

interface SidebarProps {
  projects: ProjectSuggestion[];
  selectedPath: string;
  onSelect(path: string): void;
  loading: boolean;
  error?: string;
}

export function Sidebar({
  projects,
  selectedPath,
  onSelect,
  loading,
  error
}: SidebarProps) {
  const [draft, setDraft] = useState("");
  function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim()) {
      onSelect(draft.trim());
      setDraft("");
    }
  }
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">am</span>
        <span>agent-mapper</span>
      </div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <button
        className={`project-button ${!selectedPath ? "active" : ""}`}
        onClick={() => onSelect("")}
      >
        Global overview
      </button>
      <div className="sidebar-section-label">SUGGESTED PROJECTS</div>
      {loading ? <p className="sidebar-note">Finding projects…</p> : null}
      {error ? <p className="sidebar-error">{error}</p> : null}
      {!loading && !error && projects.length === 0 ? (
        <p className="sidebar-note">
          No projects found under home. Add a folder below.
        </p>
      ) : null}
      <div className="project-list">
        {projects.map((project) => (
          <div key={project.path}>
            <button
              className={`project-button ${selectedPath === project.path ? "active" : ""}`}
              onClick={() => onSelect(project.path)}
              title={project.path}
            >
              {project.path.split("/").at(-1)}
            </button>
            {project.worktrees?.some((item) => !item.isMain) ? (
              <details
                className="worktree-group"
                open={project.worktrees.some(
                  (item) => item.path === selectedPath && !item.isMain
                )}
              >
                <summary>
                  Worktrees{" "}
                  <span>
                    {project.worktrees.filter((item) => !item.isMain).length}
                  </span>
                </summary>
                {project.worktrees
                  .filter((item) => !item.isMain)
                  .map((item) => (
                    <button
                      key={item.path}
                      className={`project-button worktree-button ${selectedPath === item.path ? "active" : ""}`}
                      onClick={() => onSelect(item.path)}
                      disabled={item.state !== "available"}
                      title={`${item.path} · ${item.state}`}
                    >
                      {item.path.split("/").at(-1)}
                      {item.state === "available" ? "" : ` · ${item.state}`}
                    </button>
                  ))}
              </details>
            ) : null}
          </div>
        ))}
      </div>
      <form className="add-folder" onSubmit={addFolder}>
        <label htmlFor="folder-path">Add folder by path</label>
        <div className="add-folder-row">
          <input
            id="folder-path"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="/Users/max/project"
          />
          <button type="submit" aria-label="Add folder">
            +
          </button>
        </div>
      </form>
      <div className="sidebar-footer">Local inventory · Read only</div>
    </aside>
  );
}
