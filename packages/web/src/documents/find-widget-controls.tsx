import type { ReactNode } from "react";
import { PixelIcon, type PixelIconName } from "../ui/pixel-icon";

export const field =
  "relative flex h-[25px] w-[230px] min-w-0 items-center border border-ink bg-surface focus-within:outline-2 focus-within:outline-accent";
export const input =
  "h-full min-w-0 flex-1 bg-transparent px-1 font-sans text-body text-ink outline-none placeholder:text-ink-faint";

export function ToolButton(props: {
  label: string;
  icon: PixelIconName;
  onClick(): void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      aria-label={props.label}
      className={`ml-[3px] flex size-[22px] shrink-0 items-center justify-center hover:bg-wash disabled:pointer-events-none disabled:text-hairline ${props.className ?? ""}`}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      <PixelIcon name={props.icon} />
    </button>
  );
}

/** A pressed option is an ink inversion, like every other "on" state. */
export function OptionToggle(props: {
  label: string;
  icon: PixelIconName;
  active: boolean;
  onToggle(): void;
}) {
  return (
    <button
      aria-label={props.label}
      aria-pressed={props.active}
      className={`ml-0.5 flex size-5 shrink-0 items-center justify-center ${props.active ? "bg-ink text-canvas" : "hover:bg-wash"}`}
      onClick={props.onToggle}
      title={props.label}
      type="button"
    >
      <PixelIcon name={props.icon} />
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
