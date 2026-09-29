import type {
  SourceDocument,
  SourceRef,
  ValidationResult
} from "@agent-mapper/core";

type DraftPhase = "editing" | "reviewing" | "conflict";

export interface Draft {
  /** One draft per real file; aliases of the same file share it. */
  sourceKey: string;
  /** The scan the document was last opened through. Every request uses it, never the current view. */
  ref: SourceRef;
  /** Base: the file as last read from disk. Dirty means `text` differs from its content. */
  document: SourceDocument;
  text: string;
  phase: DraftPhase;
  /** Frozen text and validation that the user reviewed; only this text is ever saved. */
  review?: { text: string; result: ValidationResult };
  busy?: "validating" | "saving" | "restoring";
  /** The file currently on disk, when it no longer matches the base. */
  conflict?: SourceDocument;
  /** Reviewed text whose save result is unknown; retrying resends exactly these bytes. */
  retry?: { text: string; expectedVersion: string };
  error?: string;
  notice?: string;
}

export const isDirty = (draft: Draft) => draft.text !== draft.document.content;

const refKey = (ref: SourceRef) =>
  `${ref.scope}\0${ref.workingDirectory}\0${ref.entryId}`;

/**
 * Drafts live above the per-project workspace so they survive view, tool and project changes.
 * An external store keeps typing from re-rendering the whole app.
 */
export class DraftStore {
  private drafts = new Map<string, Draft>();
  private readonly keys = new Map<string, string>();
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stable until the next change, as useSyncExternalStore requires. */
  snapshot = () => this.drafts;

  get(sourceKey: string): Draft | undefined {
    return this.drafts.get(sourceKey);
  }

  sourceKeyFor(ref: SourceRef): string | undefined {
    return this.keys.get(refKey(ref));
  }

  /** Records a freshly read document. A dirty draft keeps its text; a newer disk version becomes a conflict. */
  load(document: SourceDocument, ref: SourceRef): void {
    this.keys.set(refKey(ref), document.sourceKey);
    const existing = this.drafts.get(document.sourceKey);
    if (!existing || !isDirty(existing)) {
      this.set({
        sourceKey: document.sourceKey,
        ref,
        document,
        text: document.content,
        phase: "editing",
        notice: existing?.notice
      });
      return;
    }
    if (existing.document.version === document.version) {
      this.set({ ...existing, ref, document });
      return;
    }
    this.set({ ...existing, conflict: document, phase: "conflict" });
  }

  update(sourceKey: string, patch: Partial<Omit<Draft, "sourceKey">>): void {
    const draft = this.drafts.get(sourceKey);
    if (draft) {
      this.set({ ...draft, ...patch });
    }
  }

  setText(sourceKey: string, text: string): void {
    const draft = this.drafts.get(sourceKey);
    if (draft && draft.text !== text) {
      this.set({ ...draft, text, notice: undefined });
    }
  }

  /** Throws away unsaved text and returns to the file on disk. */
  discard(sourceKey: string): void {
    const draft = this.drafts.get(sourceKey);
    if (!draft) {
      return;
    }
    this.set({
      ...draft,
      document: draft.conflict ?? draft.document,
      text: (draft.conflict ?? draft.document).content,
      phase: "editing",
      review: undefined,
      conflict: undefined,
      retry: undefined,
      error: undefined
    });
  }

  private set(draft: Draft): void {
    this.drafts = new Map(this.drafts).set(draft.sourceKey, draft);
    for (const listener of this.listeners) {
      listener();
    }
  }
}
