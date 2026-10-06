import { Suspense, useState } from "react";
import type { PathContext } from "../model/paths";
import type { Draft } from "../state/draft-store";
import { useHost } from "../state/use-host";
import { Diagnostics } from "./diagnostics";
import { editorLanguage } from "./document-format";
import { ImpactSummary, type ImpactCoverage } from "./impact-summary";
import { SourceDiff } from "./lazy";
import type { DiffStats } from "./diff-stats";

export const loadingEditor = (
  <output className="block p-5 text-ink-muted">Loading editor…</output>
);

/** Two panes on wide screens; the notes stack under the diff when narrow. */
export const splitLayout =
  "grid h-full min-h-0 grid-rows-[minmax(16rem,1fr)_minmax(0,auto)] lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-1";
export const notesPane =
  "max-h-[45vh] overflow-auto border-t-2 border-rule p-5 lg:max-h-none lg:border-t-0 lg:border-l-2";

/** What a save or restore keeps, in the server platform's terms. */
export function useMetadataNote(): string {
  return useHost().platform === "macos"
    ? "Saving replaces the file. Its text, symlinks and permission mode are kept; macOS extended attributes, ACLs, Finder tags and the original creation date are not."
    : "Saving replaces the file. Its text, symlinks and permission mode are kept; extended attributes, ACLs and the original creation date are not.";
}

export function hasBlockingErrors(draft: Draft): boolean {
  return Boolean(
    draft.review?.result.diagnostics.some((item) => item.severity === "error")
  );
}

interface DiffResult {
  text: string;
  /** Undefined when the editor could not compute the diff. */
  stats?: DiffStats;
}

/** A green swatch for added lines and a red one for removed, matching the diff. */
function Stat({ sign, count }: { sign: "+" | "−"; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className={`size-2 ${sign === "+" ? "bg-added" : "bg-removed"}`}
      />
      {sign}
      {count}
    </span>
  );
}

/** "1 line changed +1 −1", once the diff has been computed. */
function ChangeSize({ result }: { result?: DiffResult }) {
  if (!result) {
    return <p className="m-0 mb-4 text-label text-ink-muted">Comparing…</p>;
  }
  const { stats } = result;
  if (!stats) {
    return (
      <p className="m-0 mb-4 text-label text-ink-muted">
        Could not count the changed lines. The diff still shows every change.
      </p>
    );
  }
  return (
    <p className="m-0 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
      <strong className="font-semibold">
        {stats.changed} {stats.changed === 1 ? "line" : "lines"} changed
      </strong>
      <span className="inline-flex items-center gap-3 font-mono text-mono">
        <Stat count={stats.added} sign="+" />
        <Stat count={stats.removed} sign="−" />
      </span>
    </p>
  );
}

/** Read-only diff of the file on disk against the exact text that Save will write. */
export function SourceReview({
  draft,
  coverage,
  context
}: {
  draft: Draft;
  coverage: ImpactCoverage;
  context: PathContext;
}) {
  const [diff, setDiff] = useState<DiffResult>();
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
            language={editorLanguage(draft.document)}
            modified={review.text}
            onStats={(stats) => setDiff({ text: review.text, stats })}
            original={draft.document.content}
          />
        </Suspense>
      </div>
      <aside aria-label="Review notes" className={notesPane}>
        {nothing ? (
          <p className="m-0 mb-4 text-label text-ink-muted">
            No changes: your draft matches the file on disk.
          </p>
        ) : (
          <ChangeSize result={diff?.text === review.text ? diff : undefined} />
        )}
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
          <ImpactSummary
            context={context}
            coverage={coverage}
            impact={review.result.impact}
          />
        </div>
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
            language={editorLanguage(draft.document)}
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
            <span className="font-mono text-mono">
              {draft.document.canonicalPath}
            </span>{" "}
            and now points to{" "}
            <span className="font-mono text-mono">{disk.canonicalPath}</span>.
            Nothing was written. Your draft stays attached to the original file;
            copy it or open the new target separately.
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
