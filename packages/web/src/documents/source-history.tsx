import { Suspense, useEffect, useRef, useState } from "react";
import type { RevisionContent } from "@agent-mapper/core";
import { revealSourceHistory } from "../source-document-api";
import { restoreRevision } from "../state/document-actions";
import { isDirty, type Draft } from "../state/draft-store";
import { useDocuments } from "../state/use-document-drafts";
import { tildePath, type PathContext } from "../model/paths";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Diagnostics } from "./diagnostics";
import { editorLanguage } from "./document-format";
import { SourceDiff } from "./lazy";
import { RevisionList } from "./revision-list";
import {
  loadingEditor,
  metadataNote,
  notesPane,
  splitLayout
} from "./source-review";
import { useHistoryList, useRevision, type Load } from "./use-history";

function LoadProblem(props: { message: string; onRetry(): void }) {
  return (
    <div role="alert">
      <p className="m-0 text-label text-problem">{props.message}</p>
      <Button className="mt-2" onClick={props.onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Comparison(props: {
  draft: Draft;
  selected?: Load<RevisionContent>;
  onRetry(): void;
}) {
  const { selected } = props;
  if (selected?.status === "ready") {
    return (
      <Suspense fallback={loadingEditor}>
        <SourceDiff
          label="Current file on the left, selected version on the right"
          language={editorLanguage(props.draft.document)}
          modified={selected.value.content}
          original={props.draft.document.content}
        />
      </Suspense>
    );
  }
  if (selected?.status === "error") {
    return (
      <div className="p-5">
        <LoadProblem message={selected.message} onRetry={props.onRetry} />
      </div>
    );
  }
  return (
    <p className="m-0 p-5 text-ink-muted">
      {selected
        ? "Loading version…"
        : "Select a version to compare it with the current file."}
    </p>
  );
}

/** Leaves the view only after a restore that was written, and only while this view is still shown. */
function useRestore(draft: Draft, onRestored: () => void) {
  const { store, onMutated } = useDocuments();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return async (revisionId: string) => {
    const done = await restoreRevision({
      store,
      sourceKey: draft.sourceKey,
      onMutated,
      revisionId
    });
    if (done && mounted.current) {
      onRestored();
    }
  };
}

/** The saved versions live under a long hashed folder; Finder shows it instead of printing the path. */
function RevealFolder({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string>();
  async function reveal() {
    setError(undefined);
    try {
      await revealSourceHistory(documentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <>
      <Button onClick={() => void reveal()}>Reveal in Finder</Button>
      {error ? (
        <p className="mt-2 mb-0 text-label text-problem" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function RestorePanel({
  draft,
  ready,
  onRestore
}: {
  draft: Draft;
  ready: RevisionContent;
  onRestore(revisionId: string): void;
}) {
  const blockedReason = isDirty(draft)
    ? "Save or discard your unsaved changes before restoring."
    : draft.document.readOnlyReason;
  return (
    <div className="mt-4">
      <Diagnostics diagnostics={ready.diagnostics} />
      <p className="mt-2 mb-2 text-caption text-ink-faint">
        Restoring writes the version on the right back exactly, even if it has
        warnings or errors, and keeps a copy of the current file so you can undo
        it.
      </p>
      <Button
        disabled={Boolean(blockedReason) || Boolean(draft.busy)}
        onClick={() => onRestore(ready.revision.revisionId)}
        title={metadataNote}
        variant="primary"
      >
        {draft.busy === "restoring" ? "Restoring…" : "Restore this version"}
      </Button>
      {blockedReason ? (
        <p className="mt-2 mb-0 text-label text-ink-muted">{blockedReason}</p>
      ) : null}
    </div>
  );
}

export function SourceHistory({
  draft,
  context,
  onRestored
}: {
  draft: Draft;
  context: PathContext;
  onRestored(): void;
}) {
  const { documentId, historyDirectory } = draft.document;
  const list = useHistoryList(documentId);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = useRevision(documentId, selectedId);
  const restore = useRestore(draft, onRestored);
  const ready =
    selected.load?.status === "ready" ? selected.load.value : undefined;
  const history = list.load?.status === "ready" ? list.load.value : undefined;
  if (history && !history.revisions.length && !history.problems.length) {
    return (
      <EmptyState title="No saved versions yet">
        agent-mapper keeps a copy of the file each time you save or restore it
        here.
      </EmptyState>
    );
  }
  return (
    <div className={splitLayout}>
      <div className="min-h-0">
        <Comparison
          draft={draft}
          onRetry={selected.retry}
          selected={selected.load}
        />
      </div>
      <aside aria-label="Saved versions" className={notesPane}>
        <h3
          className="m-0 mb-3 text-label font-semibold"
          title={tildePath(historyDirectory, context)}
        >
          Saved versions
        </h3>
        {list.load?.status === "error" ? (
          <LoadProblem message={list.load.message} onRetry={list.retry} />
        ) : null}
        {history ? (
          <>
            {history.problems.map((problem) => (
              <p
                className="m-0 mb-2 text-label text-problem"
                key={problem}
                role="alert"
              >
                {problem}
              </p>
            ))}
            <RevisionList
              items={history.revisions}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          </>
        ) : null}
        {list.load?.status === "loading" ? (
          <p className="m-0 text-label text-ink-muted">Loading history…</p>
        ) : null}
        {ready ? (
          <RestorePanel
            draft={draft}
            onRestore={(revisionId) => void restore(revisionId)}
            ready={ready}
          />
        ) : null}
        <div className="mt-5">
          <RevealFolder documentId={documentId} />
        </div>
      </aside>
    </div>
  );
}
