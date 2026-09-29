import { Suspense, useEffect, useState } from "react";
import type { RevisionContent, RevisionSummary } from "@agent-mapper/core";
import { sourceHistory, sourceRevision } from "../source-document-api";
import { restoreRevision } from "../state/document-actions";
import { isDirty, type Draft } from "../state/draft-store";
import { useDocuments } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { Diagnostics } from "./diagnostics";
import { SourceDiff } from "./lazy";
import {
  loadingEditor,
  metadataNote,
  notesPane,
  splitLayout
} from "./source-review";

type Load<T> =
  { status: "loading" } | { status: "ready"; value: T } | LoadError;

interface LoadError {
  status: "error";
  message: string;
}

const failed = (error: unknown): LoadError => ({
  status: "error",
  message: error instanceof Error ? error.message : String(error)
});

function placeholder(selected: Load<RevisionContent> | undefined): string {
  if (!selected) {
    return "Select a version to compare it with the current file.";
  }
  return selected.status === "error" ? selected.message : "Loading version…";
}

const kindText = {
  "before-save": "Before a save",
  "before-restore": "Before a restore"
} as const;

/** Snapshots are file bytes captured before each write, not proof that the write that followed succeeded. */
function RevisionList(props: {
  items: RevisionSummary[];
  selectedId?: string;
  onSelect(revisionId: string): void;
}) {
  if (!props.items.length) {
    return (
      <p className="m-0 text-label text-ink-muted">
        No saved versions yet. agent-mapper keeps a copy of the file each time
        you save or restore it here.
      </p>
    );
  }
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {props.items.map((item) => (
        <li key={item.revisionId}>
          <button
            aria-current={props.selectedId === item.revisionId}
            className={`w-full rounded-control px-2 py-1.5 text-left text-label ${props.selectedId === item.revisionId ? "bg-selected" : "hover:bg-hover"}`}
            onClick={() => props.onSelect(item.revisionId)}
            type="button"
          >
            <span className="block font-semibold">
              {new Date(item.capturedAt).toLocaleString()}
            </span>
            <span className="text-ink-muted">
              {kindText[item.kind]}
              {item.current ? " · matches the current file" : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function useRevision(documentId: string, revisionId: string | undefined) {
  const [state, setState] = useState<
    { id: string; load: Load<RevisionContent> } | undefined
  >();
  useEffect(() => {
    if (!revisionId) {
      return;
    }
    let current = true;
    sourceRevision({ documentId, revisionId }).then(
      (value) =>
        current &&
        setState({ id: revisionId, load: { status: "ready", value } }),
      (error: unknown) =>
        current && setState({ id: revisionId, load: failed(error) })
    );
    return () => {
      current = false;
    };
  }, [documentId, revisionId]);
  if (!revisionId) {
    return undefined;
  }
  return state?.id === revisionId ? state.load : { status: "loading" as const };
}

export function SourceHistory({
  draft,
  onRestored
}: {
  draft: Draft;
  onRestored(): void;
}) {
  const { store, onMutated } = useDocuments();
  const { documentId } = draft.document;
  const [list, setList] = useState<Load<RevisionSummary[]>>({
    status: "loading"
  });
  const [selectedId, setSelectedId] = useState<string>();
  const selected = useRevision(documentId, selectedId);
  useEffect(() => {
    let current = true;
    sourceHistory(documentId).then(
      (value) => current && setList({ status: "ready", value }),
      (error: unknown) => current && setList(failed(error))
    );
    return () => {
      current = false;
    };
  }, [documentId]);
  async function restore(revisionId: string) {
    await restoreRevision({
      store,
      sourceKey: draft.sourceKey,
      onMutated,
      revisionId
    });
    if (!store.get(draft.sourceKey)?.error) {
      onRestored();
    }
  }
  const blockedReason = isDirty(draft)
    ? "Save or discard your unsaved changes before restoring."
    : draft.document.readOnlyReason;
  return (
    <div className={splitLayout}>
      <div className="min-h-0">
        {selected?.status === "ready" ? (
          <Suspense fallback={loadingEditor}>
            <SourceDiff
              label="Current file on the left, selected version on the right"
              modified={selected.value.content}
              original={draft.document.content}
            />
          </Suspense>
        ) : (
          <p className="m-0 p-5 text-ink-muted">{placeholder(selected)}</p>
        )}
      </div>
      <aside aria-label="Saved versions" className={notesPane}>
        <h3 className="m-0 mb-1 text-label font-semibold">Saved versions</h3>
        <p className="m-0 mb-3 font-mono text-caption break-words text-ink-faint">
          {draft.document.historyDirectory}
        </p>
        {list.status === "ready" ? (
          <RevisionList
            items={list.value}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        ) : (
          <p
            className="m-0 text-label text-ink-muted"
            role={list.status === "error" ? "alert" : undefined}
          >
            {list.status === "error" ? list.message : "Loading history…"}
          </p>
        )}
        {selected?.status === "ready" ? (
          <div className="mt-4">
            <Diagnostics diagnostics={selected.value.diagnostics} />
            <p className="mt-2 mb-2 text-caption text-ink-faint">
              Restoring writes the version on the right back exactly, even if it
              has warnings, and keeps a copy of the current file so you can undo
              it. {metadataNote}
            </p>
            <Button
              disabled={Boolean(blockedReason) || Boolean(draft.busy)}
              onClick={() => void restore(selected.value.revision.revisionId)}
              variant="primary"
            >
              {draft.busy === "restoring"
                ? "Restoring…"
                : "Restore this version"}
            </Button>
            {blockedReason ? (
              <p className="mt-2 mb-0 text-label text-ink-muted">
                {blockedReason}
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
