import { Suspense, useState } from "react";
import { isDirty, type Draft } from "../state/draft-store";
import { reviewDraft } from "../state/document-actions";
import { useDocuments, useDraft } from "../state/use-document-drafts";
import { Button } from "../ui/button";
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
          ⌘S reviews changes · Ctrl+M switches Tab between indenting and moving
          focus
        </span>
      </div>
      {view === "source" ? (
        <Suspense fallback={loadingEditor}>
          <SourceEditor
            dirty={isDirty(draft)}
            label={`Edit ${draft.document.source.name}`}
            onChange={(text) => store.setText(draft.sourceKey, text)}
            onReview={() => void reviewDraft(context)}
            readOnly={Boolean(draft.busy)}
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

function StatusLine({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState<string>();
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied("Draft copied to the clipboard.");
    } catch (error) {
      setCopied(
        `Could not copy the draft (${error instanceof Error ? error.message : String(error)}). Select the text in the editor and copy it manually.`
      );
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 empty:hidden">
      {draft.error ? (
        <p className="m-0 py-2 text-label text-problem" role="alert">
          {draft.error}
        </p>
      ) : null}
      {draft.error ? (
        <Button onClick={() => void copy()}>Copy draft</Button>
      ) : null}
      <output
        aria-live="polite"
        className="py-2 text-label text-ink-muted empty:hidden"
      >
        {copied ?? statusText(draft)}
      </output>
    </div>
  );
}

function Body(props: {
  draft: Draft;
  mode: DocumentMode;
  coverage: ImpactCoverage;
  onBack(): void;
}) {
  const { draft } = props;
  if (props.mode === "history") {
    return <SourceHistory draft={draft} onRestored={props.onBack} />;
  }
  if (draft.phase === "conflict") {
    return <SourceConflict draft={draft} />;
  }
  if (draft.phase === "reviewing") {
    return <SourceReview coverage={props.coverage} draft={draft} />;
  }
  return <EditorPane draft={draft} />;
}

/**
 * Editing, review, conflict and history take the whole content and inspector area; the
 * header and view bar stay visible and the browsing view waits, untouched, underneath.
 */
export function DocumentWorkspace(props: DocumentWorkspaceProps) {
  const draft = useDraft(props.sourceKey);
  if (!draft) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <p className="text-ink-muted">This draft is no longer available.</p>
          <Button onClick={props.onBack}>Back to inventory</Button>
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
        draft={draft}
        mode={props.mode}
        onBack={props.onBack}
        onMode={props.onMode}
        onOpen={props.onOpen}
      />
      <StatusLine draft={draft} />
      <div className="min-h-0 border-t border-hairline">
        <DocumentErrorBoundary
          fallback={(message) => (
            <p className="m-0 p-5 text-label text-problem" role="alert">
              The editor could not be shown: {message}. Your draft is kept; go
              back to the inventory and reopen it, or reload agent-mapper after
              copying your text.
            </p>
          )}
        >
          <Body
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
