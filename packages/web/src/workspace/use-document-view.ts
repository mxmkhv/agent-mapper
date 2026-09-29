import { useRef, useState } from "react";
import type { DocumentMode } from "../documents/source-document-panel";

interface DocumentView {
  sourceKey: string;
  mode: DocumentMode;
}

/**
 * Which document, if any, fills the workspace. Kept apart from the browsing `View` so leaving it
 * returns to the exact view, filters and selection underneath.
 */
export function useDocumentView() {
  const [documentView, setDocumentView] = useState<DocumentView>();
  const returnFocus = useRef<HTMLElement | null>(null);
  return {
    documentView,
    openDocument(sourceKey: string, mode: DocumentMode) {
      if (!documentView && document.activeElement instanceof HTMLElement) {
        returnFocus.current = document.activeElement;
      }
      setDocumentView({ sourceKey, mode });
    },
    setDocumentMode(mode: DocumentMode) {
      setDocumentView((current) => current && { ...current, mode });
    },
    closeDocument() {
      setDocumentView(undefined);
      const target = returnFocus.current;
      returnFocus.current = null;
      requestAnimationFrame(() => {
        if (target?.isConnected) {
          target.focus();
        }
      });
    }
  };
}
