import { useState, type ReactNode } from "react";
import type { PullRequestSummary, WorktreeRecord } from "@agent-mapper/core";
import { GitBranch } from "lucide-react";
import { removeWorktree } from "../../api";
import { ConfirmButton } from "../../documents/confirm-button";
import { tildePath, type PathContext } from "../../model/paths";
import { StateLabel, StateMarker } from "../../ui/marks";
import { PullRequestBadge } from "./pull-request-badge";

const folderName = (path: string) => path.split("/").at(-1) ?? path;

interface CheckoutRowProps {
  tree: WorktreeRecord;
  context: PathContext;
  /** The difference count for available checkouts. */
  status: ReactNode;
  pullRequest?: PullRequestSummary;
  onOpen(): void;
  onRemoved(): void;
}

type Removal = { state: "idle"; error?: string } | { state: "removing" };

function RemoveAction({
  name,
  removal,
  onRemove
}: {
  name: string;
  removal: Removal;
  onRemove(): void;
}) {
  if (removal.state === "removing") {
    return <output className="text-label text-ink-muted">Removing…</output>;
  }
  return (
    <span title="Runs git worktree remove. The branch stays; Git refuses while the checkout has uncommitted changes.">
      <ConfirmButton
        confirmLabel="Remove"
        label="Remove"
        onConfirm={onRemove}
        question={`Remove ${name}?`}
      />
    </span>
  );
}

/**
 * One linked worktree: the row opens its comparison, and a separate Remove action (shown on hover or focus)
 * removes an available checkout after an inline confirmation.
 */
export function CheckoutRow({
  tree,
  context,
  status,
  pullRequest,
  onOpen,
  onRemoved
}: CheckoutRowProps) {
  const [removal, setRemoval] = useState<Removal>({ state: "idle" });
  const available = tree.state === "available";
  const folder = folderName(tree.path);
  const name = tree.branch ?? folder;
  async function remove() {
    setRemoval({ state: "removing" });
    try {
      await removeWorktree(tree.path);
      onRemoved();
    } catch (error) {
      setRemoval({
        state: "idle",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const error = removal.state === "idle" ? removal.error : undefined;
  return (
    <div className="group [&+&]:border-t [&+&]:border-wash">
      <div className={`flex items-center ${available ? "hover:bg-hover" : ""}`}>
        <button
          className="grid h-9 min-w-0 flex-1 grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-2.5 pl-3 text-left disabled:cursor-default"
          disabled={!available}
          onClick={onOpen}
          title={tildePath(tree.path, context)}
        >
          <GitBranch
            aria-hidden="true"
            className="size-4 text-ink-muted"
            strokeWidth={1.6}
          />
          <StateMarker tier={available ? "active" : "problem"} />
          <span
            className={`truncate font-semibold ${available ? "" : "text-ink-muted"}`}
          >
            {name}
          </span>
          {available ? (
            <span className="truncate font-mono text-mono text-ink-faint">
              {tree.branch ? folder : "detached"}
            </span>
          ) : (
            // Git still lists the checkout but its folder is gone; say where to look.
            <span className="truncate text-caption text-ink-muted">
              Folder unavailable · run git worktree prune
            </span>
          )}
          <span className="truncate text-right">
            {available ? (
              status
            ) : (
              <StateLabel text={tree.state} tier="problem" />
            )}
          </span>
        </button>
        {/* Links cannot sit inside the row button, so the pull request gets its own always-visible cell. */}
        <div className="flex h-9 w-[124px] shrink-0 items-center justify-end">
          {pullRequest ? <PullRequestBadge pr={pullRequest} /> : null}
        </div>
        {/* Beside the row button, not inside it; stays visible while its confirmation holds focus. */}
        <div
          className={`flex h-9 min-w-[84px] shrink-0 items-center justify-end pr-3 pl-2 ${removal.state === "removing" || error ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}
        >
          {available ? (
            <RemoveAction
              name={name}
              onRemove={() => void remove()}
              removal={removal}
            />
          ) : null}
        </div>
      </div>
      {error ? (
        <p
          className="m-0 px-3 pb-2 pl-[50px] text-label text-problem"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
