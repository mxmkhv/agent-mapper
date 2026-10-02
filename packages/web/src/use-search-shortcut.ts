import { useEffect, type Dispatch, type SetStateAction } from "react";

export function useSearchShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      // The editor marks its own shortcuts (Shift+Cmd/Ctrl+K deletes a line) as handled.
      if (event.defaultPrevented || event.isComposing) {
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
