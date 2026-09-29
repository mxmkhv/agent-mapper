import { useEffect, type Dispatch, type SetStateAction } from "react";

/** Monaco owns Cmd/Ctrl+K inside an editor, where it starts two-key chords. */
function insideEditor(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".monaco-editor"));
}

export function useSearchShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        insideEditor(event.target)
      ) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [setOpen]);
}
