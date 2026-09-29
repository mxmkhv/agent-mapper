import { createContext, use, useEffect, useSyncExternalStore } from "react";
import { isDirty, type Draft, type DraftStore } from "./draft-store";

interface DocumentsContextValue {
  store: DraftStore;
  /** Rescans the displayed context after a save or restore changed a file. */
  onMutated(): void;
}

export const DocumentsContext = createContext<
  DocumentsContextValue | undefined
>(undefined);

export function useDocuments(): DocumentsContextValue {
  const value = use(DocumentsContext);
  if (!value) {
    throw new Error(
      "Document drafts are unavailable. Render this view inside App."
    );
  }
  return value;
}

export function useDrafts(): ReadonlyMap<string, Draft> {
  const { store } = useDocuments();
  return useSyncExternalStore(store.subscribe, store.snapshot);
}

export function useDraft(sourceKey: string | undefined): Draft | undefined {
  const drafts = useDrafts();
  return sourceKey ? drafts.get(sourceKey) : undefined;
}

/** Asks before a reload or close only while unsaved drafts exist. Drafts are never written to storage. */
export function useUnloadGuard(store: DraftStore): void {
  const dirty = useSyncExternalStore(store.subscribe, () =>
    [...store.snapshot().values()].some(isDirty)
  );
  useEffect(() => {
    if (!dirty) {
      return;
    }
    function guard(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
}
