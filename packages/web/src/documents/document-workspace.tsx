import { Suspense, useEffect, useState } from "react";
import type { PathContext } from "../model/paths";
import { openSourceDocument } from "../source-document-api";
import { isDirty, type Draft } from "../state/draft-store";
import { reviewDraft } from "../state/document-actions";
import { useDocuments, useDraft } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { CopyTextButton } from "./copy-text";
import { DocumentErrorBoundary } from "./document-error-boundary";
import { DocumentToolbar } from "./document-toolbar";
import type { ImpactCoverage } from "./impact-summary";
import { SourceEditor } from "./lazy";
import type { DocumentMode } from "./source-document-panel";
import { DocumentText } from "./source-document-panel";
import { SegmentedToggle } from "./segmented-toggle";
import { SourceHistory } from "./source-history";
import { loadingEditor, SourceConflict, SourceReview } from "./source-review";

interface DocumentWorkspaceProps {
  sourceKey: string;
  mode: DocumentMode;
  coverage: ImpactCoverage;
  context: PathContext;
  /** Where Back returns to, e.g. "map". */
  backTo: string;
  onMode(mode: DocumentMode): void;
  onOpen(sourceKey: string): void;
  onBack(): void;
}

function EditorPane({ draft }: { draft: Draft }) {
  const { store } = useDocuments();
  const [view, setView] = useState<"source" | "preview">("source");
  const context = { store, sourceKey: draft.sourceKey };
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="flex items-center gap-2 border-b border-hairline px-5 py-2">
        <SegmentedToggle<"source" | "preview">
          label="Editor view"
          onChange={setView}
          options={[
            { value: "source", label: "Source" },
            { value: "preview", label: "Preview" }
          ]}
          value={view}
        />
        <span className="hidden text-caption text-ink-faint md:inline">
          ⌘S to review
        </span>
        <span className="sr-only">
          Ctrl+M switches Tab between indenting and moving focus.
        </span>
      </div>
      {view === "source" ? (
        <Suspense fallback={loadingEditor}>
          <SourceEditor
            dirty={isDirty(draft)}
            label={`Edit ${draft.document.source.name}`}
            onChange={(text) => store.setText(draft.sourceKey, text)}
            onReview={() => void reviewDraft(context)}
            readOnly={Boolean(draft.busy) || !draft.document.editable}
            sourceKey={draft.sourceKey}
            text={draft.text}
          />
        </Suspense>
      ) : (
        <div className="min-h-0 overflow-auto p-5">
          <DocumentText content={draft.text} view="preview" />
        </div>
      )}
    </div>
  );
}

const busyText = {
  validating: "Checking your changes…",
  saving: "Saving…",
  restoring: "Restoring…"
} as const;

function statusText(draft: Draft): string {
  if (draft.busy) {
    return busyText[draft.busy];
  }
  return draft.notice ?? "";
}

/** One row for errors, progress and the recheck note, so the body always gets the flexible last row. */
function StatusLine({ draft, note }: { draft: Draft; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5">
      {draft.error ? (
        <p className="m-0 py-2 text-label text-problem" role="alert">
          {draft.error}
        </p>
      ) : null}
      {draft.error && isDirty(draft) ? (
        <CopyTextButton label="Copy draft" text={draft.text} />
      ) : null}
      <output
        aria-live="polite"
        className="py-2 text-label text-ink-muted empty:hidden"
      >
        {statusText(draft)}
      </output>
      {note ? (
        <output className="py-2 text-label text-ink-muted">{note}</output>
      ) : null}
    </div>
  );
}

function Body(props: {
  draft: Draft;
  mode: DocumentMode;
  coverage: ImpactCoverage;
  context: PathContext;
  onBack(): void;
}) {
  const { draft } = props;
  // A conflict outranks the chosen mode: it must be seen before anything else is written.
  if (draft.phase === "conflict") {
    return <SourceConflict draft={draft} />;
  }
  if (props.mode === "history") {
    return (
      <SourceHistory
        context={props.context}
        draft={draft}
        onRestored={props.onBack}
      />
    );
  }
  if (draft.phase === "reviewing") {
    return (
      <SourceReview
        context={props.context}
        coverage={props.coverage}
        draft={draft}
      />
    );
  }
  return <EditorPane draft={draft} />;
}

/**
 * Editing, review, conflict and history take the whole content and inspector area; the
 * header and view bar stay visible and the browsing view waits, untouched, underneath.
 */
/** Opening a draft (for example from the Drafts menu) rechecks the file on disk; changes become a conflict. */
function useRevalidate(sourceKey: string) {
  const { store } = useDocuments();
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    const ref = store.get(sourceKey)?.ref;
    if (!ref) {
      return;
    }
    const controller = new AbortController();
    openSourceDocument(ref, controller.signal).then(
      (document) => store.revalidate(sourceKey, document),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setProblem(
            `Could not recheck the file on disk: ${error instanceof Error ? error.message : String(error)} Saving still checks for changes first.`
          );
        }
      }
    );
    return () => controller.abort();
  }, [store, sourceKey]);
  return problem;
}

export function DocumentWorkspace(props: DocumentWorkspaceProps) {
  const draft = useDraft(props.sourceKey);
  const recheckProblem = useRevalidate(props.sourceKey);
  if (!draft) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <p className="text-ink-muted">This draft is no longer available.</p>
          <Button onClick={props.onBack}>Back to {props.backTo}</Button>
        </div>
      </div>
    );
  }
  return (
    <section
      aria-label={`${draft.document.source.name} document`}
      className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] bg-surface"
    >
      <DocumentToolbar
        backTo={props.backTo}
        context={props.context}
        draft={draft}
        mode={props.mode}
        onBack={props.onBack}
        onMode={props.onMode}
        onOpen={props.onOpen}
      />
      <StatusLine draft={draft} note={recheckProblem} />
      <div className="min-h-0 border-t border-hairline">
        <DocumentErrorBoundary
          fallback={(message) => (
            <div className="p-5" role="alert">
              <p className="m-0 mb-3 text-label text-problem">
                The editor could not be shown: {message}. Your draft is still in
                memory. Copy it, then reload agent-mapper; a reload is needed if
                part of the app failed to download.
              </p>
              <CopyTextButton label="Copy draft" text={draft.text} />
            </div>
          )}
        >
          <Body
            context={props.context}
            coverage={props.coverage}
            draft={draft}
            mode={props.mode}
            onBack={props.onBack}
          />
        </DocumentErrorBoundary>
      </div>
    </section>
  );
}
