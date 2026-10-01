import { useState } from "react";
import { Folder, GitBranch, X } from "lucide-react";
import type { ProjectSuggestion } from "../api";
import { NavItem } from "./nav-item";

const visibleWorktrees = 3;
export const folderName = (path: string) => path.split("/").at(-1) ?? path;

function Worktrees({
  project,
  selectedPath,
  onSelect
}: {
  project: ProjectSuggestion;
  selectedPath: string;
  onSelect(path: string): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const linked = project.worktrees?.filter((tree) => !tree.isMain) ?? [];
  const shown = expanded ? linked : linked.slice(0, visibleWorktrees);
  return (
    <div className="pb-1">
      {shown.map((tree) => (
        <button
          key={tree.path}
          className={`block h-[26px] w-full truncate rounded-control pr-2 pl-8 text-left text-label disabled:cursor-default disabled:text-ink-faint ${selectedPath === tree.path ? "bg-selected text-ink" : "text-ink-muted hover:bg-hover"}`}
          disabled={tree.state !== "available"}
          onClick={() => onSelect(tree.path)}
          title={`${tree.path} · ${tree.state}`}
        >
          {tree.branch ?? folderName(tree.path)}
        </button>
      ))}
      {linked.length > visibleWorktrees ? (
        <button
          className="h-[26px] pl-8 text-label text-ink-faint hover:text-ink"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Show fewer"
            : `${linked.length - visibleWorktrees} more worktrees`}
        </button>
      ) : null}
    </div>
  );
}

/** The selected folder is this project or one of its worktrees. */
export function containsSelection(
  project: ProjectSuggestion,
  selectedPath: string
): boolean {
  return (
    selectedPath === project.path ||
    Boolean(project.worktrees?.some((tree) => tree.path === selectedPath))
  );
}

export function ProjectList({
  projects,
  selectedPath,
  onSelect,
  onRemove
}: {
  projects: ProjectSuggestion[];
  selectedPath: string;
  onSelect(path: string): void;
  onRemove(project: ProjectSuggestion): void;
}) {
  return projects.map((project) => {
    const linked =
      project.worktrees?.filter((tree) => !tree.isMain).length ?? 0;
    const name = folderName(project.path);
    return (
      <div key={project.path}>
        {/* The remove action sits beside the row button, not inside it, and takes the worktree count's place on hover. */}
        <div className="group relative">
          <NavItem
            active={selectedPath === project.path}
            onClick={() => onSelect(project.path)}
            title={project.path}
          >
            <Folder
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-muted"
              strokeWidth={1.6}
            />
            <span className="min-w-0 flex-1 truncate pr-5">{name}</span>
            {linked ? (
              <span className="flex items-center gap-1 text-caption text-ink-faint tabular-nums group-has-focus-visible:opacity-0 group-hover:opacity-0">
                <GitBranch
                  aria-hidden="true"
                  className="size-3.5"
                  strokeWidth={1.6}
                />
                {linked}
              </span>
            ) : null}
          </NavItem>
          <button
            aria-label={`Remove ${name} from the list`}
            className="absolute top-[3px] right-1 grid size-6 place-items-center rounded-control text-ink-muted opacity-0 group-has-focus-visible:opacity-100 group-hover:opacity-100 hover:bg-hover hover:text-ink"
            onClick={() => onRemove(project)}
            title="Remove from list. Restore it under Removed."
          >
            <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>
        {containsSelection(project, selectedPath) && linked ? (
          <Worktrees
            project={project}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ) : null}
      </div>
    );
  });
}
