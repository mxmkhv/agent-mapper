import { ArrowLeft } from "lucide-react";
import { reviewDraft, saveReviewed } from "../state/document-actions";
import { isDirty, type Draft } from "../state/draft-store";
import { useDocuments } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { ToolGlyph } from "../ui/marks";
import type { DocumentMode } from "./source-document-panel";
import { hasBlockingErrors } from "./source-review";

interface ToolbarProps {
  draft: Draft;
  mode: DocumentMode;
  onMode(mode: DocumentMode): void;
  onOpen(sourceKey: string): void;
  onBack(): void;
}

function saveLabel(draft: Draft): string {
  if (draft.busy === "saving") {
    return "Saving…";
  }
  return draft.outcomeUnknown ? "Save again" : "Save changes";
}

function ConflictActions({
  draft,
  onOpen
}: Pick<ToolbarProps, "draft" | "onOpen">) {
  const { store } = useDocuments();
  const disk = draft.conflict;
  if (!disk) {
    return null;
  }
  if (disk.sourceKey !== draft.sourceKey) {
    return (
      <Button
        onClick={() => {
          store.load(disk, draft.ref);
          onOpen(disk.sourceKey);
        }}
      >
        Open the new target
      </Button>
    );
  }
  return (
    <>
      <Button
        onClick={() => {
          if (window.confirm("Discard your draft and use the current file?")) {
            store.discard(draft.sourceKey);
          }
        }}
      >
        Use current file
      </Button>
      <Button onClick={() => store.rebase(draft.sourceKey)} variant="primary">
        Continue editing
      </Button>
    </>
  );
}

function PhaseActions(props: ToolbarProps) {
  const { draft } = props;
  const { store, onMutated } = useDocuments();
  const context = { store, sourceKey: draft.sourceKey };
  if (draft.phase === "conflict") {
    return <ConflictActions draft={draft} onOpen={props.onOpen} />;
  }
  if (props.mode === "history") {
    return draft.document.editable ? (
      <Button onClick={() => props.onMode("edit")}>Edit</Button>
    ) : null;
  }
  if (draft.phase === "reviewing") {
    const nothing = draft.review?.text === draft.document.content;
    return (
      <>
        <Button
          disabled={draft.busy === "saving"}
          onClick={() => store.backToEdit(draft.sourceKey)}
        >
          Back to edit
        </Button>
        <Button
          disabled={Boolean(draft.busy) || nothing || hasBlockingErrors(draft)}
          onClick={() => void saveReviewed({ ...context, onMutated })}
          variant="primary"
        >
          {saveLabel(draft)}
        </Button>
      </>
    );
  }
  const dirty = isDirty(draft);
  return (
    <>
      <Button onClick={() => props.onMode("history")}>History</Button>
      {dirty ? (
        <Button
          disabled={Boolean(draft.busy)}
          onClick={() => {
            if (
              window.confirm(
                `Discard unsaved changes to ${draft.document.source.name}?`
              )
            ) {
              store.discard(draft.sourceKey);
            }
          }}
        >
          Discard changes
        </Button>
      ) : null}
      <Button
        disabled={!dirty || Boolean(draft.busy) || !draft.document.editable}
        onClick={() => void reviewDraft(context)}
        title={draft.document.readOnlyReason}
        variant="primary"
      >
        {draft.busy === "validating" ? "Checking…" : "Review changes"}
      </Button>
    </>
  );
}

export function DocumentToolbar(props: ToolbarProps) {
  const { draft } = props;
  const { document } = draft;
  const aliases = document.impact.aliases.length;
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 pt-3 pb-2">
      {/* Below ~24rem of room the actions wrap under the title instead of squeezing it. */}
      <div className="min-w-[min(24rem,100%)] flex-1">
        <div className="flex items-center gap-2">
          <ToolGlyph tool={document.source.tool} />
          <h2 className="m-0 truncate text-headline font-semibold tracking-tight">
            {document.source.name}
          </h2>
          {isDirty(draft) ? (
            <span className="text-label text-ink-muted">
              <span aria-hidden="true">●</span> Unsaved changes
            </span>
          ) : null}
        </div>
        <p className="m-0 mt-1 font-mono text-caption break-all text-ink-muted">
          {document.canonicalPath}
          {document.source.path !== document.canonicalPath
            ? ` (opened through ${document.source.path})`
            : ""}
        </p>
        {aliases > 1 ? (
          <p className="m-0 mt-1 text-caption text-ink-muted">
            Shared file: {aliases} known paths point here, so a save changes
            each of them.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PhaseActions {...props} />
        <Button onClick={props.onBack}>
          <ArrowLeft
            aria-hidden="true"
            className="size-3.5"
            strokeWidth={1.8}
          />
          Back to inventory
        </Button>
      </div>
    </div>
  );
}
