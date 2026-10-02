import { useState } from "react";
import type { ProjectSuggestion } from "../api";
import type { ThemeChoice } from "../state/use-theme";
import { AddFolder } from "./add-folder";
import { PixelIcon, type PixelIconName } from "../ui/pixel-icon";
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

const nextTheme = {
  auto: "light",
  light: "dark",
  dark: "auto"
} satisfies Record<ThemeChoice, ThemeChoice>;

const themeIcon = {
  auto: "theme-auto",
  light: "sun",
  dark: "moon"
} satisfies Record<ThemeChoice, PixelIconName>;

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
  return (
    <button
      aria-label={`Appearance: ${themeName[theme]}. Switch to ${themeName[nextTheme[theme]]}`}
      className="ml-auto grid size-6 place-items-center text-ink-muted hover:bg-wash hover:text-ink"
      onClick={() => onTheme(nextTheme[theme])}
      title={`Appearance: ${themeName[theme]}`}
    >
      <PixelIcon name={themeIcon[theme]} />
    </button>
  );
}

/** The pixel bot on an ink square. The favicon is the same bot on the selected tool's hue. */
function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-[26px] shrink-0 place-items-center bg-ink text-canvas"
    >
      <PixelIcon large name="bot" />
    </span>
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
    <aside className="flex min-h-0 flex-col overflow-auto border-r-2 border-rule bg-sidebar px-2 pt-[19px] pb-2">
      <div className="flex items-center gap-2.5 px-2 pb-5 font-mono text-mono">
        <BrandMark />
        agent-mapper
        <ThemeButton onTheme={props.onTheme} theme={props.theme} />
      </div>
      <NavItem active={!selectedPath} onClick={() => onSelect("")}>
        <PixelIcon name="globe" />
        Global
      </NavItem>
      <div className="px-2 pt-3.5 pb-1.5 text-label text-ink-muted">
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
      <div className="mt-auto grid gap-0.5 border-t border-dotted border-hairline pt-2">
        <RemovedProjects
          paths={props.hiddenProjects}
          onRestore={(path) => void setHidden(path, false)}
        />
        <AddFolder onAdd={onSelect} />
      </div>
    </aside>
  );
}
