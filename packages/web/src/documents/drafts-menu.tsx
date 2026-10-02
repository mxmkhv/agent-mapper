import { useEffect, useState } from "react";
import { tildePath, type PathContext } from "../model/paths";
import { isDirty } from "../state/draft-store";
import { useDrafts } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { PixelIcon } from "../ui/pixel-icon";

/** Keeps every unsaved draft reachable, even when its source left the current view or inventory. */
export function DraftsMenu({
  context,
  onOpen
}: {
  context: PathContext;
  onOpen(sourceKey: string): void;
}) {
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
        <PixelIcon name="doc" />
        Drafts ({drafts.length})
      </Button>
      {open ? (
        <ul
          aria-label="Unsaved drafts"
          className="absolute top-8 right-0 z-40 m-0 grid w-96 max-w-[calc(100vw-2rem)] list-none border-2 border-ink bg-surface p-0"
        >
          {drafts.map((draft) => (
            <li
              className="border-b border-dotted border-hairline last:border-b-0"
              key={draft.sourceKey}
            >
              <button
                className="w-full px-2 py-1.5 text-left hover:bg-wash"
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
                  {tildePath(draft.document.canonicalPath, context)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
