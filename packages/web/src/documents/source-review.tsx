import { Suspense } from "react";
import type { Draft } from "../state/draft-store";
import { Diagnostics } from "./diagnostics";
import { ImpactSummary, type ImpactCoverage } from "./impact-summary";
import { SourceDiff } from "./lazy";

export const loadingEditor = (
  <output className="block p-5 text-ink-muted">Loading editor…</output>
);

/** Two panes on wide screens; the notes stack under the diff when narrow. */
export const splitLayout =
  "grid h-full min-h-0 grid-rows-[minmax(16rem,1fr)_minmax(0,auto)] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1";
export const notesPane =
  "max-h-[45vh] overflow-auto border-t border-hairline p-5 lg:max-h-none lg:border-t-0 lg:border-l";

export const metadataNote =
  "Saving replaces the file. Its text, symlinks and permission mode are kept; macOS extended attributes, ACLs, Finder tags and the original creation date are not.";

export function hasBlockingErrors(draft: Draft): boolean {
  return Boolean(
    draft.review?.result.diagnostics.some((item) => item.severity === "error")
  );
}

/** Read-only diff of the file on disk against the exact text that Save will write. */
export function SourceReview({
  draft,
  coverage
}: {
  draft: Draft;
  coverage: ImpactCoverage;
}) {
  const review = draft.review;
  if (!review) {
    return null;
  }
  const nothing = review.text === draft.document.content;
  return (
    <div className={splitLayout}>
      <div className="min-h-0">
        <Suspense fallback={loadingEditor}>
          <SourceDiff
            label="Changes to review: file on disk on the left, your draft on the right"
            modified={review.text}
            original={draft.document.content}
          />
        </Suspense>
      </div>
      <aside aria-label="Review notes" className={notesPane}>
        <h3 className="m-0 mb-2 text-label font-semibold">Review changes</h3>
        {nothing ? (
          <p className="m-0 mb-2 text-label text-ink-muted">
            No changes: your draft matches the file on disk.
          </p>
        ) : null}
        {review.result.unchanged && !nothing ? (
          <p className="m-0 mb-2 text-label text-ink-muted">
            The file on disk already contains this text, probably from an
            earlier save. Saving will confirm it without writing again.
          </p>
        ) : null}
        <Diagnostics diagnostics={review.result.diagnostics} />
        {hasBlockingErrors(draft) ? (
          <p className="mt-2 mb-0 text-label text-problem">
            Fix the errors above before saving.
          </p>
        ) : null}
        <div className="mt-4">
          <ImpactSummary coverage={coverage} impact={review.result.impact} />
        </div>
        <p className="mt-4 mb-0 text-caption text-ink-faint">{metadataNote}</p>
      </aside>
    </div>
  );
}

/** The disk changed under the draft: compare them without touching either. */
export function SourceConflict({ draft }: { draft: Draft }) {
  const disk = draft.conflict;
  if (!disk) {
    return null;
  }
  const moved = disk.sourceKey !== draft.sourceKey;
  return (
    <div className={splitLayout}>
      <div className="min-h-0">
        <Suspense fallback={loadingEditor}>
          <SourceDiff
            label="Conflict: current file on the left, your draft on the right"
            modified={draft.text}
            original={disk.content}
          />
        </Suspense>
      </div>
      <aside aria-label="Conflict details" className={notesPane}>
        <h3 className="m-0 mb-2 text-label font-semibold text-problem">
          {moved
            ? "This path now points to another file"
            : "The file changed on disk"}
        </h3>
        {moved ? (
          <p className="m-0 text-label break-words text-ink-muted">
            It pointed to{" "}
            <span className="font-mono">{draft.document.canonicalPath}</span>{" "}
            and now points to{" "}
            <span className="font-mono">{disk.canonicalPath}</span>. Nothing was
            written. Your draft stays attached to the original file; copy it or
            open the new target separately.
          </p>
        ) : (
          <p className="m-0 text-label text-ink-muted">
            Nothing was written and your draft is kept. Use the current file to
            drop your changes, or continue editing on top of it and review
            again.
          </p>
        )}
      </aside>
    </div>
  );
}
