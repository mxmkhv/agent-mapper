import { Info } from "lucide-react";

export type View = "map" | "reach" | "inventory" | "findings" | "worktrees";

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

export function ViewBar(props: ViewBarProps) {
  return (
    <nav
      aria-label="Views"
      className="flex items-center gap-1 border-b border-hairline px-5"
    >
      {props.tabs.map((tab) => (
        <button
          key={tab.id}
          aria-current={props.view === tab.id ? "page" : undefined}
          className={`relative inline-flex h-9 items-center gap-1.5 px-2.5 font-semibold ${props.view === tab.id ? "text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink" : "text-ink-muted hover:text-ink"}`}
          onClick={() => props.onView(tab.id)}
        >
          {tab.label}
          {tab.count === undefined ? null : (
            <span
              className={`text-caption tabular-nums ${tab.alert ? "text-problem" : "text-ink-faint"}`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
      <span className="flex-1" />
      <button
        aria-pressed={props.showInactive}
        className="mr-2 inline-flex items-center gap-2 text-label text-ink-muted hover:text-ink"
        onClick={props.onToggleInactive}
      >
        <span
          className={`relative h-4 w-[26px] rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-surface after:transition-transform ${props.showInactive ? "bg-ink after:translate-x-2.5" : "bg-hairline-strong"}`}
        />
        Show inactive ({props.inactiveCount})
      </button>
      <button
        className="inline-flex h-[26px] items-center gap-1.5 rounded-control px-1.5 text-label text-ink-muted hover:bg-hover hover:text-ink"
        onClick={props.onCoverage}
      >
        <Info aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
        {props.coverageCount} coverage notes
      </button>
    </nav>
  );
}
