import { Suspense, useEffect, useState, type ReactNode } from "react";
import type { SourceRef } from "@agent-mapper/core";
import { openSourceDocument } from "../source-document-api";
import { isDirty } from "../state/draft-store";
import { useDocuments, useDraft } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { PixelIcon } from "../ui/pixel-icon";
import { Diagnostics } from "./diagnostics";
import { DocumentErrorBoundary } from "./document-error-boundary";
import { isToml } from "./document-format";
import { MarkdownPreview } from "./lazy";
import { SegmentedToggle } from "./segmented-toggle";

export type DocumentMode = "edit" | "history";

interface SourceDocumentPanelProps {
  sourceRef: SourceRef;
  /** Changes after each rescan, so a saved file is re-read. */
  scannedAt: string;
  onOpen(sourceKey: string, mode: DocumentMode): void;
  /** Further actions on the file, placed right after Edit. */
  actions?: ReactNode;
}

type LoadState =
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; sourceKey: string }
  | { status: "error"; key: string; message: string };

const refKey = (ref: SourceRef, scannedAt: string) =>
  `${ref.scope}\0${ref.workingDirectory}\0${ref.entryId}\0${scannedAt}`;

/** Loads only the selected document. A slow read for a previous selection is aborted, never shown. */
function useSourceDocument(ref: SourceRef, scannedAt: string) {
  const { store } = useDocuments();
  const key = refKey(ref, scannedAt);
  const [state, setState] = useState<LoadState>({ status: "loading", key });
  const [attempt, setAttempt] = useState(0);
  const { scope, workingDirectory, entryId } = ref;
  useEffect(() => {
    const controller = new AbortController();
    const current = { scope, workingDirectory, entryId };
    openSourceDocument(current, controller.signal).then(
      (document) => {
        store.load(document, current);
        setState({ status: "ready", key, sourceKey: document.sourceKey });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: "error",
            key,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
    return () => controller.abort();
  }, [store, key, scope, workingDirectory, entryId, attempt]);
  const visible: LoadState =
    state.key === key ? state : { status: "loading", key };
  return { state: visible, retry: () => setAttempt((value) => value + 1) };
}

/** Empty files are valid documents, not load errors. */
export function DocumentText({
  content,
  view
}: {
  content: string;
  view: "preview" | "source";
}) {
  if (!content) {
    return <p className="m-0 text-ink-muted">Empty file.</p>;
  }
  if (view === "source") {
    return (
      <pre className="m-0 font-code text-label break-words whitespace-pre-wrap">
        {content}
      </pre>
    );
  }
  return (
    <DocumentErrorBoundary
      fallback={(message) => (
        <>
          <p className="mt-0 text-label text-problem" role="alert">
            The preview could not be rendered ({message}); showing the source.
          </p>
          <pre className="m-0 font-code text-label break-words whitespace-pre-wrap">
            {content}
          </pre>
        </>
      )}
    >
      <Suspense
        fallback={<output className="text-ink-muted">Rendering…</output>}
      >
        <MarkdownPreview content={content} />
      </Suspense>
    </DocumentErrorBoundary>
  );
}

export function SourceDocumentPanel({
  sourceRef,
  scannedAt,
  onOpen,
  actions
}: SourceDocumentPanelProps) {
  const { state, retry } = useSourceDocument(sourceRef, scannedAt);
  const draft = useDraft(
    state.status === "ready" ? state.sourceKey : undefined
  );
  const [view, setView] = useState<"preview" | "source">("preview");
  if (state.status === "error") {
    return (
      <div role="alert">
        <p className="m-0 text-label text-problem">{state.message}</p>
        {/* Copy and Delete still apply to an item whose file cannot be shown. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button onClick={retry}>Try again</Button>
          {actions}
        </div>
      </div>
    );
  }
  if (!draft) {
    return (
      <output className="text-label text-ink-muted">Loading source…</output>
    );
  }
  const { document } = draft;
  const dirty = isDirty(draft);
  const toml = isToml(document);
  return (
    <div>
      {/* Edit leads: it is the main thing to do with an app-editable file, and wrapping keeps it from clipping. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!document.editable}
          onClick={() => onOpen(draft.sourceKey, "edit")}
          title={document.readOnlyReason}
          variant="primary"
        >
          <PixelIcon name="edit" />
          {dirty ? "Continue editing" : "Edit"}
        </Button>
        {actions}
        <span className="flex-1" />
        {/* History is a look back, not a next step: a quiet icon at the end of the row. */}
        <Button
          aria-label="History"
          onClick={() => onOpen(draft.sourceKey, "history")}
          title="History"
          variant="icon"
        >
          <PixelIcon name="history" />
        </Button>
      </div>
      {/* The view toggle belongs to the text below it, so it gets its own row and never wraps into the actions. TOML has no rendered form. */}
      {toml ? null : (
        <div className="mt-2.5 flex">
          <SegmentedToggle<"preview" | "source">
            label="Source view"
            onChange={setView}
            options={[
              { value: "preview", label: "Preview" },
              { value: "source", label: "Source" }
            ]}
            value={view}
          />
        </div>
      )}
      <output
        aria-live="polite"
        className="mt-2 block text-label text-ink-muted"
      >
        {dirty
          ? "You have unsaved changes to this file."
          : (draft.notice ?? "")}
      </output>
      {document.readOnlyReason ? (
        <p className="mt-1 mb-0 text-label text-ink-muted">
          Read-only: {document.readOnlyReason}
        </p>
      ) : null}
      <Diagnostics diagnostics={document.diagnostics} />
      <div className="mt-2 max-h-[60vh] overflow-auto border border-rule bg-surface p-3">
        <DocumentText
          content={document.content}
          view={toml ? "source" : view}
        />
      </div>
    </div>
  );
}
