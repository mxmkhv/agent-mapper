import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { isDirty } from "../state/draft-store";
import { useDrafts } from "../state/use-document-drafts";
import { Button } from "../ui/button";

/** Keeps every unsaved draft reachable, even when its source left the current view or inventory. */
export function DraftsMenu({ onOpen }: { onOpen(sourceKey: string): void }) {
  const drafts = [...useDrafts().values()].filter(isDirty);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      return;
    }
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (!drafts.length) {
    return null;
  }
  return (
    <div className="relative">
      <Button aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <FileText aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        Drafts ({drafts.length})
      </Button>
      {open ? (
        <ul
          aria-label="Unsaved drafts"
          className="absolute top-8 right-0 z-30 m-0 grid w-80 max-w-[calc(100vw-2rem)] list-none gap-0.5 rounded-panel border border-hairline bg-surface p-1 shadow-dialog"
        >
          {drafts.map((draft) => (
            <li key={draft.sourceKey}>
              <button
                className="w-full rounded-control px-2 py-1.5 text-left hover:bg-hover"
                onClick={() => {
                  setOpen(false);
                  onOpen(draft.sourceKey);
                }}
                type="button"
              >
                <span className="block text-label font-semibold">
                  {draft.document.source.name}
                </span>
                <span className="block font-mono text-caption break-all text-ink-muted">
                  {draft.document.canonicalPath}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
