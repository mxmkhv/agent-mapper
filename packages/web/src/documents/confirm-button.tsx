import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../ui/button";

interface ConfirmButtonProps {
  label: string;
  question: string;
  confirmLabel: string;
  disabled?: boolean;
  /**
   * In a table row: the question floats over the cells to its left as a raised strip, anchored where the
   * button was, so nothing in the row moves. The parent must be `relative` and keep the button's width.
   */
  floating?: boolean;
  onConfirm(): void;
}

/** Asks in place instead of a native dialog: the button gives way to the question and its two answers. */
export function ConfirmButton(props: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  // The asking button unmounts as the question appears; move keyboard focus to the safe answer once.
  useEffect(() => {
    if (asking) {
      keep.current?.focus();
    }
  }, [asking]);
  if (!asking) {
    return (
      <Button disabled={props.disabled} onClick={() => setAsking(true)}>
        {props.label}
      </Button>
    );
  }
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setAsking(false);
    }
  };
  return (
    <fieldset
      className={
        props.floating
          ? "absolute top-1/2 right-2 z-10 m-0 flex -translate-y-1/2 items-center gap-2 rounded-card border border-hairline bg-surface py-0.5 pr-0.5 pl-3 whitespace-nowrap shadow-raised"
          : "m-0 inline-flex min-w-0 items-center gap-2 border-0 p-0"
      }
    >
      {/* The legend names the group for screen readers; the visible question repeats it inline. */}
      <legend className="sr-only">{props.question}</legend>
      <span aria-hidden="true" className="text-label text-ink-muted">
        {props.question}
      </span>
      <Button
        onClick={() => setAsking(false)}
        onKeyDown={cancelOnEscape}
        ref={keep}
      >
        Keep
      </Button>
      <Button
        className="text-problem"
        onClick={() => {
          setAsking(false);
          props.onConfirm();
        }}
        onKeyDown={cancelOnEscape}
      >
        {props.confirmLabel}
      </Button>
    </fieldset>
  );
}
