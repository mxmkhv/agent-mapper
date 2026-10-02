import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const iconProps = {
  size: 16,
  strokeWidth: 1.5,
  "aria-hidden": true
} as const;
export const field =
  "relative flex h-[25px] w-[230px] min-w-0 items-center rounded-[4px] border border-transparent bg-(--monaco-input-background) focus-within:outline focus-within:outline-1 focus-within:outline-focus";
export const input =
  "h-full min-w-0 flex-1 bg-transparent px-1 font-sans text-[13px] text-(--monaco-widget-foreground) outline-none placeholder:text-ink-faint";

export function ToolButton(props: {
  label: string;
  icon: LucideIcon;
  onClick(): void;
  disabled?: boolean;
  className?: string;
}) {
  const Icon = props.icon;
  return (
    <button
      aria-label={props.label}
      className={`ml-[3px] flex size-[22px] shrink-0 items-center justify-center rounded-[5px] hover:bg-(--monaco-toolbar-hover) disabled:pointer-events-none disabled:opacity-30 ${props.className ?? ""}`}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      <Icon {...iconProps} />
    </button>
  );
}

export function OptionToggle(props: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onToggle(): void;
}) {
  const Icon = props.icon;
  return (
    <button
      aria-label={props.label}
      aria-pressed={props.active}
      className={`ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-[3px] border ${props.active ? "border-[#007acc] bg-focus/20 dark:bg-focus/40" : "border-transparent hover:bg-(--monaco-toolbar-hover)"}`}
      onClick={props.onToggle}
      title={props.label}
      type="button"
    >
      <Icon {...iconProps} />
    </button>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    // In a narrow pane the fields shrink first; the right padding keeps them clear of the close button.
    <div className="mt-[3px] ml-[17px] flex h-[25px] min-w-0 items-center pr-[25px]">
      {children}
    </div>
  );
}
