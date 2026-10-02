import { isDirty, type DraftStore } from "../state/draft-store";
import { CopyTextButton } from "./copy-text";

/** Last-resort screen: the app failed to render, but unsaved drafts are still in memory and can be copied. */
export function AppFailure(props: { message: string; store: DraftStore }) {
  const drafts = [...props.store.snapshot().values()].filter(isDirty);
  return (
    <div className="grid place-items-center p-10" role="alert">
      <div className="max-w-xl">
        <h2 className="font-mono text-title">agent-mapper stopped rendering</h2>
        <p className="text-ink-muted">
          {props.message}. Reload the page to continue.
          {drafts.length
            ? " Unsaved drafts are lost on reload, so copy them first."
            : ""}
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {drafts.map((draft) => (
            <li className="grid gap-1" key={draft.sourceKey}>
              <span className="font-mono text-caption break-all">
                {draft.document.canonicalPath}
              </span>
              <CopyTextButton label="Copy draft" text={draft.text} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
