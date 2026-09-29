import { useState, type ReactNode } from "react";
import { Folder, GitBranch, Globe, Lock } from "lucide-react";
import type { ProjectSuggestion } from "../api";
import type { ThemeChoice } from "../state/use-theme";
import { AddFolder } from "./add-folder";

interface SidebarProps {
  projects: ProjectSuggestion[];
  selectedPath: string;
  loading: boolean;
  error?: string;
  theme: ThemeChoice;
  onSelect(path: string): void;
  onTheme(choice: ThemeChoice): void;
}

const visibleWorktrees = 3;
const iconClass = "size-4 shrink-0 text-ink-muted";

function NavItem({
  active,
  onClick,
  children,
  title
}: {
  active: boolean;
  onClick(): void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      className={`flex h-[30px] w-full items-center gap-2 rounded-control px-2 text-left ${active ? "bg-selected font-semibold" : "hover:bg-hover"}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

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
          {tree.branch ?? tree.path.split("/").at(-1)}
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

function ProjectList({
  projects,
  selectedPath,
  onSelect
}: Pick<SidebarProps, "projects" | "selectedPath" | "onSelect">) {
  return projects.map((project) => {
    const linked =
      project.worktrees?.filter((tree) => !tree.isMain).length ?? 0;
    const inProject =
      selectedPath === project.path ||
      project.worktrees?.some((tree) => tree.path === selectedPath);
    return (
      <div key={project.path}>
        <NavItem
          active={selectedPath === project.path}
          onClick={() => onSelect(project.path)}
          title={project.path}
        >
          <Folder aria-hidden="true" className={iconClass} strokeWidth={1.6} />
          <span className="min-w-0 flex-1 truncate">
            {project.path.split("/").at(-1)}
          </span>
          {linked ? (
            <span className="flex items-center gap-1 text-caption text-ink-faint tabular-nums">
              <GitBranch
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.6}
              />
              {linked}
            </span>
          ) : null}
        </NavItem>
        {inProject && linked ? (
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

function ThemeSwitch({
  theme,
  onTheme
}: Pick<SidebarProps, "theme" | "onTheme">) {
  const choices: ThemeChoice[] = ["auto", "light", "dark"];
  return (
    <fieldset className="mx-2 mt-2 flex min-w-0 gap-0.5 rounded-button border-0 bg-wash p-0.5">
      <legend className="sr-only">Appearance</legend>
      {choices.map((choice) => (
        <button
          key={choice}
          aria-pressed={theme === choice}
          className={`h-6 flex-1 rounded-control text-caption capitalize ${theme === choice ? "bg-surface text-ink shadow-raised" : "text-ink-muted"}`}
          onClick={() => onTheme(choice)}
        >
          {choice}
        </button>
      ))}
    </fieldset>
  );
}

export function Sidebar(props: SidebarProps) {
  const { selectedPath, onSelect, loading, error } = props;
  return (
    <aside className="flex min-h-0 flex-col overflow-auto border-r border-hairline bg-sidebar px-2.5 pt-3.5 pb-2.5">
      <div className="flex items-center gap-2 px-2 pb-4 font-semibold tracking-tight">
        <span className="grid size-[22px] place-items-center rounded-control bg-ink text-[11px] font-bold text-canvas">
          am
        </span>
        agent-mapper
      </div>
      <NavItem active={!selectedPath} onClick={() => onSelect("")}>
        <Globe aria-hidden="true" className={iconClass} strokeWidth={1.6} />
        Global
      </NavItem>
      <div className="px-2 pt-3.5 pb-1 text-caption font-semibold text-ink-faint">
        Projects
      </div>
      {loading ? (
        <p className="m-2 text-label text-ink-muted">Finding projects…</p>
      ) : null}
      {error ? (
        <p className="m-2 text-label text-problem" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && props.projects.length === 0 ? (
        <p className="m-2 text-label text-ink-muted">
          No projects found under home. Add a folder below.
        </p>
      ) : null}
      <ProjectList
        projects={props.projects}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
      <div className="mt-auto grid gap-0.5 pt-3">
        <AddFolder onAdd={onSelect} />
        <ThemeSwitch theme={props.theme} onTheme={props.onTheme} />
        <div className="flex items-center gap-1.5 px-2 pt-2 text-caption text-ink-faint">
          <Lock aria-hidden="true" className="size-3" strokeWidth={1.6} />
          Changes only files you save
        </div>
      </div>
    </aside>
  );
}
