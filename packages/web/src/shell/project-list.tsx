import { useState } from "react";
import type { ProjectSuggestion } from "../api";
import { ConfirmButton } from "../documents/confirm-button";
import { PixelIcon } from "../ui/pixel-icon";
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
          className={`block h-[26px] w-full truncate pr-2 pl-[29px] text-left font-mono text-mono disabled:cursor-default disabled:text-ink-faint ${selectedPath === tree.path ? "bg-ink text-canvas" : "text-ink-muted hover:bg-wash"}`}
          disabled={tree.state !== "available"}
          onClick={() => onSelect(tree.path)}
          title={`${tree.path} · ${tree.state}`}
        >
          {tree.branch ?? folderName(tree.path)}
        </button>
      ))}
      {linked.length > visibleWorktrees ? (
        <button
          className="h-[26px] pl-[29px] text-label text-ink-faint hover:text-ink"
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
            <PixelIcon name="folder" />
            <span className="min-w-0 flex-1 truncate pr-5 font-mono text-mono">
              {name}
            </span>
            {linked ? (
              <span className="flex items-center gap-1 font-mono text-mono opacity-70 group-has-focus-visible:opacity-0 group-hover:opacity-0">
                <PixelIcon name="branch" />
                {linked}
              </span>
            ) : null}
          </NavItem>
          <ConfirmButton
            confirmLabel="Remove"
            label={`Remove ${name} from the list`}
            onConfirm={() => onRemove(project)}
            placement="over"
            question={`Remove ${name} from the list?`}
            trigger={(ask) => (
              <button
                aria-label={`Remove ${name} from the list`}
                className="absolute top-[3px] right-1 grid size-6 place-items-center bg-surface text-ink opacity-0 group-has-focus-visible:opacity-100 group-hover:opacity-100 hover:bg-wash"
                onClick={ask}
                title="Remove from list. The folder stays; restore it under Removed."
              >
                <PixelIcon name="close" />
              </button>
            )}
          />
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
