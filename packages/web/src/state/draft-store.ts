import type {
  SourceDocument,
  SourceRef,
  ValidationResult
} from "@agent-mapper/core";

type DraftPhase = "editing" | "reviewing" | "conflict";

interface Review {
  text: string;
  result: ValidationResult;
}

export interface Draft {
  /** One draft per real file; aliases of the same file share it. */
  sourceKey: string;
  /** The scan the file was last opened through; used to reopen it. Requests use `document.documentId`. */
  ref: SourceRef;
  /** Base: the file as last read from disk. Dirty means `text` differs from its content. */
  document: SourceDocument;
  text: string;
  phase: DraftPhase;
  /** Frozen text and validation the user reviewed; only this text is ever saved. Set only while reviewing. */
  review?: Review;
  busy?: "validating" | "saving" | "restoring";
  /** The file on disk now, or the new link target, when it no longer matches the base. Set only in conflict. */
  conflict?: SourceDocument;
  /** The last save's response was lost; saving again resends the same reviewed text and never writes twice. */
  outcomeUnknown?: boolean;
  error?: string;
  notice?: string;
}

export const isDirty = (draft: Draft) => draft.text !== draft.document.content;

const refKey = (ref: SourceRef) =>
  `${ref.scope}\0${ref.workingDirectory}\0${ref.entryId}`;

/** Fields that belong to one phase; every phase change clears all of them before setting its own. */
const cleared = {
  review: undefined,
  busy: undefined,
  conflict: undefined,
  outcomeUnknown: undefined,
  error: undefined
} as const;

/**
 * Drafts live above the per-project workspace so they survive view, tool and project changes.
 * An external store keeps typing from re-rendering the whole app. State changes go through the
 * named transitions below, so phase-specific fields cannot outlive their phase.
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
    // A running save or restore refreshes the draft itself when it finishes.
    if (existing?.busy) {
      return;
    }
    if (!existing || !isDirty(existing) || existing.text === document.content) {
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
    // Same bytes on disk: adopt the fresh handle and keep any review in progress.
    if (existing.document.version === document.version) {
      const fresh: Draft = { ...existing, ref, document };
      // A conflict whose disk version is back to the base is resolved.
      this.set(
        existing.phase === "conflict"
          ? { ...fresh, ...cleared, phase: "editing" }
          : fresh
      );
      return;
    }
    this.set({
      ...existing,
      ...cleared,
      ref,
      phase: "conflict",
      conflict: document
    });
  }

  /** Rechecks an open draft against the file its path resolves to now. */
  revalidate(sourceKey: string, document: SourceDocument): void {
    const draft = this.drafts.get(sourceKey);
    if (!draft) {
      return;
    }
    if (document.sourceKey === sourceKey) {
      this.load(document, draft.ref);
    } else {
      this.setConflict(sourceKey, document);
    }
  }

  setText(sourceKey: string, text: string): void {
    const draft = this.drafts.get(sourceKey);
    if (draft?.phase === "editing" && draft.text !== text) {
      this.set({ ...draft, text, notice: undefined });
    }
  }

  begin(sourceKey: string, busy: NonNullable<Draft["busy"]>): void {
    this.patch(sourceKey, { busy, error: undefined, notice: undefined });
  }

  fail(sourceKey: string, error: string): void {
    this.patch(sourceKey, { busy: undefined, error });
  }

  review(sourceKey: string, review: Review): void {
    this.patch(sourceKey, { ...cleared, phase: "reviewing", review });
  }

  backToEdit(sourceKey: string): void {
    this.patch(sourceKey, { ...cleared, phase: "editing" });
  }

  /** The save may have landed; keep the review so Save resends exactly the same text. */
  outcomeUnknown(sourceKey: string, error: string): void {
    this.patch(sourceKey, { busy: undefined, outcomeUnknown: true, error });
  }

  setConflict(sourceKey: string, disk: SourceDocument): void {
    this.patch(sourceKey, { ...cleared, phase: "conflict", conflict: disk });
  }

  /** A save or restore wrote `document`; it becomes the clean base. */
  committed(
    sourceKey: string,
    change: { document: SourceDocument; notice: string }
  ): void {
    this.patch(sourceKey, {
      ...cleared,
      phase: "editing",
      document: change.document,
      text: change.document.content,
      notice: change.notice
    });
  }

  /** Keeps the text and adopts the file on disk as the new base; the next save needs a fresh review. */
  rebase(sourceKey: string): void {
    const draft = this.drafts.get(sourceKey);
    if (draft?.conflict?.sourceKey === sourceKey) {
      this.patch(sourceKey, {
        ...cleared,
        phase: "editing",
        document: draft.conflict
      });
    }
  }

  /** Throws away unsaved text and returns to the file on disk. */
  discard(sourceKey: string): void {
    const draft = this.drafts.get(sourceKey);
    if (!draft) {
      return;
    }
    const base =
      draft.conflict?.sourceKey === sourceKey ? draft.conflict : draft.document;
    this.patch(sourceKey, {
      ...cleared,
      phase: "editing",
      document: base,
      text: base.content
    });
  }

  private patch(
    sourceKey: string,
    change: Partial<Omit<Draft, "sourceKey">>
  ): void {
    const draft = this.drafts.get(sourceKey);
    if (draft) {
      this.set({ ...draft, ...change });
    }
  }

  private set(draft: Draft): void {
    this.drafts = new Map(this.drafts).set(draft.sourceKey, draft);
    for (const listener of this.listeners) {
      listener();
    }
  }
}
