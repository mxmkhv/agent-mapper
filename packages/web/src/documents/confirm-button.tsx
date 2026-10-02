import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { Button } from "../ui/button";

/**
 * Where the question appears. Inline replaces the button in the flow. The other two float as a raised strip so
 * nothing around them moves; the parent must be `relative`. `end` anchors at the button's right edge and grows
 * left over a table row's cells. `over` starts at the parent's left edge and grows right, past the parent and
 * anything that clips it, for a sidebar row too narrow to hold the question.
 */
type Placement = "inline" | "end" | "over";

const strip =
  "z-40 m-0 flex items-center gap-2 border-2 border-ink bg-surface py-0.5 pr-0.5 pl-3 whitespace-nowrap";

const placements: Record<Placement, string> = {
  inline: "m-0 inline-flex min-w-0 items-center gap-2 border-0 p-0",
  end: `absolute top-1/2 right-2 -translate-y-1/2 ${strip}`,
  over: `fixed -translate-y-1/2 ${strip}`
};

interface ConfirmButtonProps {
  label: string;
  question: string;
  confirmLabel: string;
  disabled?: boolean;
  placement?: Placement;
  /** Replaces the default text button, for example with an icon button; pass `ask` as its click handler. */
  trigger?(ask: (event: MouseEvent<HTMLElement>) => void): ReactNode;
  onConfirm(): void;
}

/**
 * An `over` strip is fixed to the viewport so a scrolling sidebar cannot clip it: it sits where the row that
 * positions the asking button (its offset parent) is at the moment of the click.
 */
function rowPosition(button: HTMLElement): CSSProperties | undefined {
  const rect = button.offsetParent?.getBoundingClientRect();
  return rect && { top: rect.top + rect.height / 2, left: rect.left };
}

/** A click anywhere else, like Escape, leaves the question unanswered; so does scrolling, which would move its row. */
function useDismiss(asking: boolean, close: () => void) {
  const group = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!asking) {
      return undefined;
    }
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !group.current?.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [asking, close]);
  return group;
}

/** Asks in place instead of a native dialog: the button gives way to the question and its two answers. */
export function ConfirmButton(props: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const [position, setPosition] = useState<CSSProperties>();
  const keep = useRef<HTMLButtonElement>(null);
  const [close] = useState(() => () => setAsking(false));
  const group = useDismiss(asking, close);
  const placement = props.placement ?? "inline";
  // The asking button unmounts as the question appears; move keyboard focus to the safe answer once.
  useEffect(() => {
    if (asking) {
      keep.current?.focus();
    }
  }, [asking]);
  if (!asking) {
    const ask = (event: MouseEvent<HTMLElement>) => {
      setPosition(
        placement === "over" ? rowPosition(event.currentTarget) : undefined
      );
      setAsking(true);
    };
    return props.trigger ? (
      props.trigger(ask)
    ) : (
      <Button disabled={props.disabled} onClick={ask}>
        {props.label}
      </Button>
    );
  }
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      close();
    }
  };
  return (
    <fieldset className={placements[placement]} ref={group} style={position}>
      {/* The legend names the group for screen readers; the visible question repeats it inline. */}
      <legend className="sr-only">{props.question}</legend>
      <span aria-hidden="true" className="text-label text-ink-muted">
        {props.question}
      </span>
      <Button onClick={close} onKeyDown={cancelOnEscape} ref={keep}>
        Keep
      </Button>
      <Button
        className="text-problem"
        onClick={() => {
          close();
          props.onConfirm();
        }}
        onKeyDown={cancelOnEscape}
      >
        {props.confirmLabel}
      </Button>
    </fieldset>
  );
}
