import { useState, type ReactNode } from "react";
import type { PullRequestSummary, WorktreeRecord } from "@agent-mapper/core";
import { pruneWorktree, removeWorktree } from "../../api";
import { ConfirmButton } from "../../documents/confirm-button";
import { tildePath, type PathContext } from "../../model/paths";
import { StateLabel, StateMarker } from "../../ui/marks";
import { PixelIcon } from "../../ui/pixel-icon";
import { PullRequestBadge } from "./pull-request-badge";

const folderName = (path: string) => path.split("/").at(-1) ?? path;

interface CheckoutRowProps {
  tree: WorktreeRecord;
  context: PathContext;
  /** The difference count for available checkouts. */
  status: ReactNode;
  pullRequest?: PullRequestSummary;
  /** A checkout of the repository that still exists, which Git runs in to prune a stale entry. */
  repository?: string;
  onOpen(): void;
  onRemoved(): void;
}

type Removal = { state: "idle"; error?: string } | { state: "removing" };

/** Remove deletes an available checkout; Prune only clears Git's record of one whose folder is already gone. */
const actions = {
  remove: {
    label: "Remove",
    busy: "Removing…",
    title:
      "Runs git worktree remove. Git refuses while the checkout has uncommitted changes or untracked files; ignored files such as .env and node_modules are deleted with the folder. The branch stays.",
    question: (name: string) =>
      `Remove ${name}? Ignored files like .env go too.`
  },
  prune: {
    label: "Prune",
    busy: "Pruning…",
    title:
      "The folder is already gone. This clears Git's leftover record of the worktree; the branch and its commits stay.",
    question: (name: string) => `Clear Git's record of ${name}?`
  }
};

function RowAction({
  kind,
  name,
  removal,
  onConfirm
}: {
  kind: keyof typeof actions;
  name: string;
  removal: Removal;
  onConfirm(): void;
}) {
  const action = actions[kind];
  if (removal.state === "removing") {
    return <output className="text-label text-ink-muted">{action.busy}</output>;
  }
  return (
    <span title={action.title}>
      <ConfirmButton
        confirmLabel={action.label}
        placement="end"
        label={action.label}
        onConfirm={onConfirm}
        question={action.question(name)}
      />
    </span>
  );
}

/** Runs the row's Remove or Prune, keeping Git's refusal next to the row it belongs to. */
function useRemoval(action: () => Promise<void>, onRemoved: () => void) {
  const [removal, setRemoval] = useState<Removal>({ state: "idle" });
  async function run() {
    setRemoval({ state: "removing" });
    try {
      await action();
      onRemoved();
    } catch (error) {
      setRemoval({
        state: "idle",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return {
    removal,
    error: removal.state === "idle" ? removal.error : undefined,
    run
  };
}

/** The checkout's folder, or what became of it when Git still lists a checkout whose folder is gone. */
function Whereabouts({
  tree,
  folder,
  prunable
}: {
  tree: WorktreeRecord;
  folder: string;
  prunable: boolean;
}) {
  if (tree.state === "available") {
    return (
      <span className="truncate font-mono text-mono text-ink-faint">
        {tree.branch ? folder : "detached"}
      </span>
    );
  }
  return (
    <span className="truncate text-caption text-ink-muted">
      {prunable
        ? "Folder is gone · only Git's record is left"
        : "Folder unavailable · run git worktree prune"}
    </span>
  );
}

/**
 * One linked worktree: the row opens its comparison, and a separate Remove action (shown on hover or focus)
 * removes an available checkout after an inline confirmation. A stale entry offers Prune instead, always
 * visible, since clearing it is the only thing left to do with the row.
 */
export function CheckoutRow({
  tree,
  context,
  status,
  pullRequest,
  repository,
  onOpen,
  onRemoved
}: CheckoutRowProps) {
  const available = tree.state === "available";
  const folder = folderName(tree.path);
  const name = tree.branch ?? folder;
  const prunable = tree.state === "prunable" && repository !== undefined;
  const { removal, error, run } = useRemoval(
    () =>
      prunable
        ? pruneWorktree(repository, tree.path)
        : removeWorktree(tree.path),
    onRemoved
  );
  return (
    <div className="group [&+&]:border-t [&+&]:border-dotted [&+&]:border-hairline">
      <div className={`flex items-center ${available ? "hover:bg-wash" : ""}`}>
        <button
          className="grid h-9 min-w-0 flex-1 grid-cols-[11px_7px_minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-3 pl-3 text-left disabled:cursor-default"
          disabled={!available}
          onClick={onOpen}
          title={tildePath(tree.path, context)}
        >
          <PixelIcon name="branch" />
          <StateMarker tier={available ? "active" : "problem"} />
          <span
            className={`truncate font-mono text-mono ${available ? "" : "text-ink-muted"}`}
          >
            {name}
          </span>
          <Whereabouts folder={folder} prunable={prunable} tree={tree} />
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
          className={`relative flex h-9 w-[96px] shrink-0 items-center justify-end pr-3 pl-2 ${removal.state === "removing" || error || prunable ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}
        >
          {available || prunable ? (
            <RowAction
              kind={prunable ? "prune" : "remove"}
              name={name}
              onConfirm={() => void run()}
              removal={removal}
            />
          ) : null}
        </div>
      </div>
      {error ? (
        <p
          className="m-0 px-3 pb-2 pl-[54px] text-label text-problem"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
