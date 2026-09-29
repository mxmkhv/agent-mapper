import type { MutationResult } from "@agent-mapper/core";
import {
  DocumentRequestError,
  openSourceDocument,
  restoreSourceRevision,
  saveSourceDocument,
  validateSourceDocument
} from "../source-document-api";
import type { DraftStore } from "./draft-store";

/**
 * Review, save and restore are event handlers. Each binds to the draft's own document handle
 * and SourceRef, so a result that arrives after navigation still lands on the right file.
 */
interface ActionContext {
  store: DraftStore;
  sourceKey: string;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** A stale version means the disk moved on: reopen to compare, keeping the draft. */
async function recover(context: ActionContext, error: unknown): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft) {
    return;
  }
  if (!(error instanceof DocumentRequestError) || error.code !== "conflict") {
    store.update(sourceKey, { busy: undefined, error: message(error) });
    return;
  }
  try {
    const disk = await openSourceDocument(draft.ref);
    store.update(sourceKey, {
      busy: undefined,
      conflict: disk,
      phase: "conflict",
      review: undefined,
      retry: undefined,
      error: undefined
    });
  } catch (reopenError) {
    store.update(sourceKey, {
      busy: undefined,
      error: `${error.message} Reopening the file also failed: ${message(reopenError)}`
    });
  }
}

export async function reviewDraft(context: ActionContext): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft || draft.busy) {
    return;
  }
  const text = draft.text;
  store.update(sourceKey, { busy: "validating", error: undefined });
  try {
    const result = await validateSourceDocument({
      documentId: draft.document.documentId,
      sourceKey,
      expectedVersion: draft.document.version,
      content: text
    });
    store.update(sourceKey, {
      busy: undefined,
      phase: "reviewing",
      review: { text, result }
    });
  } catch (error) {
    await recover(context, error);
  }
}

async function finish(
  context: ActionContext & { onMutated(): void; done: string },
  result: MutationResult
): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft) {
    return;
  }
  context.onMutated();
  const saved =
    result.outcome === "saved"
      ? context.done
      : "Nothing to write: the file already matches.";
  let document = result.document;
  if (!document) {
    try {
      document = await openSourceDocument(draft.ref);
    } catch (error) {
      store.update(sourceKey, {
        busy: undefined,
        review: undefined,
        retry: undefined,
        error: `${saved} Reading the file back failed: ${message(error)} Rescan and reopen it before editing again.`
      });
      return;
    }
  }
  store.update(sourceKey, {
    document,
    text: document.content,
    phase: "editing",
    review: undefined,
    retry: undefined,
    busy: undefined,
    conflict: undefined,
    error: undefined,
    notice: [saved, ...(result.warnings ?? [])].join(" ")
  });
}

/** Saves only the reviewed text. A lost response keeps the same bytes for retry, which reconciles. */
export async function saveReviewed(
  context: ActionContext & { onMutated(): void }
): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft?.review || draft.busy) {
    return;
  }
  const request = draft.retry ?? {
    text: draft.review.text,
    expectedVersion: draft.document.version
  };
  store.update(sourceKey, { busy: "saving", error: undefined, retry: request });
  let result: MutationResult;
  try {
    result = await saveSourceDocument({
      documentId: draft.document.documentId,
      sourceKey,
      expectedVersion: request.expectedVersion,
      content: request.text
    });
  } catch (error) {
    if (error instanceof DocumentRequestError && error.code === "network") {
      store.update(sourceKey, { busy: undefined, error: error.message });
      return;
    }
    store.update(sourceKey, { retry: undefined });
    await recover(context, error);
    return;
  }
  await finish({ ...context, done: "Saved." }, result);
}

export async function restoreRevision(
  context: ActionContext & { onMutated(): void; revisionId: string }
): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft || draft.busy) {
    return;
  }
  store.update(sourceKey, { busy: "restoring", error: undefined });
  try {
    const result = await restoreSourceRevision({
      documentId: draft.document.documentId,
      sourceKey,
      expectedVersion: draft.document.version,
      revisionId: context.revisionId
    });
    await finish({ ...context, done: "Restored." }, result);
  } catch (error) {
    await recover(context, error);
  }
}

/** Keeps the draft and adopts the file on disk as the new base; the next save needs a fresh review. */
export function rebaseOnDisk(context: ActionContext): void {
  const draft = context.store.get(context.sourceKey);
  if (!draft?.conflict) {
    return;
  }
  context.store.update(context.sourceKey, {
    document: draft.conflict,
    conflict: undefined,
    phase: "editing",
    review: undefined
  });
}
