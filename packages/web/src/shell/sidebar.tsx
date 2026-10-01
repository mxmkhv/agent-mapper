import { useState } from "react";
import { Globe, Moon, Sun, SunMoon } from "lucide-react";
import type { ProjectSuggestion } from "../api";
import type { ThemeChoice } from "../state/use-theme";
import { AddFolder } from "./add-folder";
import { NavItem } from "./nav-item";
import { containsSelection, folderName, ProjectList } from "./project-list";
import { RemovedProjects } from "./removed-projects";

interface SidebarProps {
  projects: ProjectSuggestion[];
  hiddenProjects: string[];
  selectedPath: string;
  loading: boolean;
  error?: string;
  theme: ThemeChoice;
  onSelect(path: string): void;
  onTheme(choice: ThemeChoice): void;
  onSetHidden(path: string, hidden: boolean): Promise<void>;
}

const iconClass = "size-4 shrink-0 text-ink-muted";

const nextTheme = {
  auto: "light",
  light: "dark",
  dark: "auto"
} satisfies Record<ThemeChoice, ThemeChoice>;

const themeIcon = { auto: SunMoon, light: Sun, dark: Moon } satisfies Record<
  ThemeChoice,
  typeof Sun
>;

const themeName = {
  auto: "Auto",
  light: "Light",
  dark: "Dark"
} satisfies Record<ThemeChoice, string>;

/** One button cycles Auto → Light → Dark; the icon shows the current choice. */
function ThemeButton({
  theme,
  onTheme
}: Pick<SidebarProps, "theme" | "onTheme">) {
  const Icon = themeIcon[theme];
  return (
    <button
      aria-label={`Appearance: ${themeName[theme]}. Switch to ${themeName[nextTheme[theme]]}`}
      className="ml-auto grid size-6 place-items-center rounded-control text-ink-muted hover:bg-hover hover:text-ink"
      onClick={() => onTheme(nextTheme[theme])}
      title={`Appearance: ${themeName[theme]}`}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
    </button>
  );
}

export function Sidebar(props: SidebarProps) {
  const { selectedPath, onSelect, loading, error } = props;
  const [actionError, setActionError] = useState<string>();
  /** Resolves true once saved; a failure shows beside the list instead of throwing. */
  async function setHidden(path: string, hidden: boolean): Promise<boolean> {
    setActionError(undefined);
    try {
      await props.onSetHidden(path, hidden);
      return true;
    } catch (failure) {
      const reason =
        failure instanceof Error ? failure.message : String(failure);
      setActionError(
        `Could not ${hidden ? "remove" : "restore"} ${folderName(path)}. ${reason}`
      );
      return false;
    }
  }
  async function remove(project: ProjectSuggestion) {
    // Leaving a removed project's folder selected would keep showing it; fall back to Global.
    const wasSelected = containsSelection(project, selectedPath);
    if ((await setHidden(project.path, true)) && wasSelected) {
      onSelect("");
    }
  }
  return (
    <aside className="flex min-h-0 flex-col overflow-auto border-r border-hairline bg-sidebar px-2.5 pt-3.5 pb-2.5">
      <div className="flex items-center gap-2 px-2 pb-4 font-semibold tracking-tight">
        <span className="grid size-[22px] place-items-center rounded-control bg-ink text-[11px] font-bold text-canvas">
          am
        </span>
        agent-mapper
        <ThemeButton onTheme={props.onTheme} theme={props.theme} />
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
        onRemove={(project) => void remove(project)}
      />
      {actionError ? (
        <p className="m-2 text-label text-problem" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="mt-auto grid gap-0.5 pt-3">
        <RemovedProjects
          paths={props.hiddenProjects}
          onRestore={(path) => void setHidden(path, false)}
        />
        <AddFolder onAdd={onSelect} />
      </div>
    </aside>
  );
}
