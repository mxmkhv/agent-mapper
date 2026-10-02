import type { RevisionSummary } from "@agent-mapper/core";

const kindText = {
  "before-save": "Before a save",
  "before-restore": "Before a restore"
} as const;

/** Snapshots are file bytes captured before each write, not proof that the write that followed succeeded. */
export function RevisionList(props: {
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
    <ul className="m-0 grid list-none p-0">
      {props.items.map((item) => (
        <li
          className="border-b border-dotted border-hairline last:border-b-0"
          key={item.revisionId}
        >
          <button
            aria-current={props.selectedId === item.revisionId}
            className={`w-full px-2 py-1.5 text-left text-label ${props.selectedId === item.revisionId ? "on-accent bg-accent" : "hover:bg-wash"}`}
            onClick={() => props.onSelect(item.revisionId)}
            type="button"
          >
            <span className="block font-mono text-mono">
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
