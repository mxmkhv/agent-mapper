import type { RecordKind } from "../model/record-types";
import { PixelIcon } from "../ui/pixel-icon";

export type View = "projects" | "inventory" | "findings" | "worktrees";

/** Where to land after switching to a project: an item to select, or a view with an optional kind filter. */
export type Landing =
  { selectId: string } | { view: Exclude<View, "projects">; kind?: RecordKind };

export interface ViewTab {
  id: View;
  label: string;
  count?: number;
  alert?: boolean;
}

interface ViewBarProps {
  tabs: ViewTab[];
  view: View;
  showInactive: boolean;
  inactiveCount: number;
  coverageCount: number;
  onView(view: View): void;
  onToggleInactive(): void;
  onCoverage(): void;
}

/** On the accent tab the count takes the tab's own text colour; red on the accent would not be readable. */
function activeCount(active: boolean, alert?: boolean): string {
  if (active) {
    return "";
  }
  return alert ? "text-problem" : "text-ink-faint";
}

export function ViewBar(props: ViewBarProps) {
  return (
    <nav
      aria-label="Views"
      className="flex items-end gap-1 border-b-2 border-rule px-5"
    >
      {props.tabs.map((tab) => (
        <button
          key={tab.id}
          aria-current={props.view === tab.id ? "page" : undefined}
          className={`inline-flex h-[30px] items-center gap-2 border-2 border-b-0 px-3 font-semibold ${props.view === tab.id ? "border-ink bg-accent text-on-accent dark:border-accent" : "border-transparent text-ink-muted hover:text-ink"}`}
          onClick={() => props.onView(tab.id)}
        >
          {tab.label}
          {tab.count === undefined ? null : (
            <span
              className={`font-mono text-mono ${activeCount(props.view === tab.id, tab.alert)}`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
      <span className="flex-1" />
      <button
        aria-pressed={props.showInactive}
        className="mr-2 inline-flex h-9 shrink-0 items-center gap-2 text-label whitespace-nowrap text-ink-muted hover:text-ink"
        onClick={props.onToggleInactive}
      >
        <span
          className={`relative h-3.5 w-7 border-2 border-current after:absolute after:top-0.5 after:left-0.5 after:size-1.5 after:bg-current ${props.showInactive ? "bg-ink text-canvas after:translate-x-3.5" : ""}`}
        />
        <span>
          <span className="lg:hidden">Inactive</span>
          <span className="max-lg:hidden">Show inactive</span> (
          {props.inactiveCount})
        </span>
      </button>
      <button
        className="mb-[5px] inline-flex h-[26px] items-center gap-1.5 px-1.5 text-ink-muted hover:bg-wash hover:text-ink"
        onClick={props.onCoverage}
        title={`${props.coverageCount} coverage notes`}
      >
        <PixelIcon name="info" />
        <span className="font-mono text-mono">{props.coverageCount}</span>
        <span className="sr-only">coverage notes</span>
      </button>
    </nav>
  );
}
