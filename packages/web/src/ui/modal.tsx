import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  title: string;
  /** While work is running the dialog stays open: Escape, the backdrop, and the close button wait. */
  busy?: boolean;
  onClose(): void;
  children: ReactNode;
  /** The answers, right-aligned under the body. */
  footer: ReactNode;
}

/**
 * A native modal dialog: the browser traps focus, dims the page, and closes on Escape.
 * The dialog fills the viewport so a plain button behind the panel can close it on an outside click.
 * The panel hangs from the top, like the search palette, so it does not jump as its content grows.
 */
export function Modal(props: ModalProps) {
  const { busy, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      aria-label={props.title}
      className="m-0 grid size-full max-h-none max-w-none place-items-start justify-center bg-transparent p-0 pt-[12vh] text-ink backdrop:bg-black/30"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      ref={dialog}
    >
      <div className="relative z-10 flex max-h-[76vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-dialog border border-hairline bg-surface shadow-dialog">
        <header className="flex items-start gap-3 px-5 pt-4 pb-1">
          <h2 className="m-0 min-w-0 flex-1 text-title font-semibold tracking-tight break-words">
            {props.title}
          </h2>
          <Button
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            variant="icon"
          >
            <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          </Button>
        </header>
        <div className="grid min-h-0 gap-4 overflow-auto px-5 py-4">
          {props.children}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-hairline px-5 py-3">
          {props.footer}
        </footer>
      </div>
      {/* After the panel in the DOM, so opening the dialog focuses a control inside the panel first. */}
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        disabled={busy}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
    </dialog>
  );
}
