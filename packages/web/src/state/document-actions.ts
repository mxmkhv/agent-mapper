import type { MutationResult } from "@agent-mapper/core";
import {
  DocumentRequestError,
  openSourceDocument,
  restoreSourceRevision,
  saveSourceDocument,
  validateSourceDocument
} from "../source-document-api";
import type { DraftStore } from "./draft-store";

// Review, save and restore are event handlers. Each binds to the draft's own document handle and
// SourceRef, so a result that arrives after navigation still lands on the right file.

interface ActionContext {
  store: DraftStore;
  sourceKey: string;
}

type MutationContext = ActionContext & { onMutated(): void };

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * A 409 conflict means the disk moved on: reopen through the draft's own SourceRef and show the
 * conflict, keeping the draft. Any other failure is shown as it is.
 */
async function recover(context: ActionContext, error: unknown): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft) {
    return;
  }
  if (!(error instanceof DocumentRequestError) || error.code !== "conflict") {
    store.fail(sourceKey, message(error));
    return;
  }
  try {
    store.setConflict(sourceKey, await openSourceDocument(draft.ref));
  } catch (reopenError) {
    store.fail(
      sourceKey,
      `${error.message} Reopening the file also failed: ${message(reopenError)}`
    );
  }
}

export async function reviewDraft(context: ActionContext): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft || draft.busy || draft.phase !== "editing") {
    return;
  }
  const { text } = draft;
  store.begin(sourceKey, "validating");
  try {
    const result = await validateSourceDocument({
      documentId: draft.document.documentId,
      sourceKey,
      expectedVersion: draft.document.version,
      content: text
    });
    const current = store.get(sourceKey);
    // Discarded or edited while checking: this result describes text that is gone.
    if (current?.busy !== "validating" || current.text !== text) {
      return;
    }
    store.review(sourceKey, { text, result });
  } catch (error) {
    if (store.get(sourceKey)?.busy === "validating") {
      await recover(context, error);
    }
  }
}

/** Adopts what a save or restore wrote, reopening the file when the server could not read it back. */
async function finish(
  context: MutationContext & { done: string },
  result: MutationResult
): Promise<void> {
  const { store, sourceKey } = context;
  context.onMutated();
  const draft = store.get(sourceKey);
  if (!draft) {
    return;
  }
  const done =
    result.outcome === "saved"
      ? context.done
      : "Nothing to write: the file already matches.";
  const notice = [done, ...(result.warnings ?? [])].join(" ");
  if (result.document) {
    store.committed(sourceKey, { document: result.document, notice });
    return;
  }
  try {
    const document = await openSourceDocument(draft.ref);
    store.committed(sourceKey, { document, notice });
  } catch (error) {
    store.backToEdit(sourceKey);
    store.fail(
      sourceKey,
      `${notice} Reopening the file failed: ${message(error)} Rescan and reopen it before editing again.`
    );
  }
}

/** Saves only the reviewed text. A lost response keeps the review, so Save resends the same bytes. */
export async function saveReviewed(context: MutationContext): Promise<void> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft?.review || draft.busy || draft.phase !== "reviewing") {
    return;
  }
  store.begin(sourceKey, "saving");
  let result: MutationResult;
  try {
    result = await saveSourceDocument({
      documentId: draft.document.documentId,
      sourceKey,
      expectedVersion: draft.document.version,
      content: draft.review.text
    });
  } catch (error) {
    if (error instanceof DocumentRequestError && error.code === "network") {
      store.outcomeUnknown(
        sourceKey,
        `${error.message} The save may already have been written; Save again sends the same reviewed text and never writes it twice.`
      );
      return;
    }
    await recover(context, error);
    return;
  }
  await finish({ ...context, done: "Saved." }, result);
}

/** Returns true only when the restore was written, so callers never treat a conflict as success. */
export async function restoreRevision(
  context: MutationContext & { revisionId: string }
): Promise<boolean> {
  const { store, sourceKey } = context;
  const draft = store.get(sourceKey);
  if (!draft || draft.busy) {
    return false;
  }
  store.begin(sourceKey, "restoring");
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
  const after = store.get(sourceKey);
  return after?.phase === "editing" && !after.error;
}
