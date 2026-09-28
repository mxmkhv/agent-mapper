import { useState } from "react";
import type { WorktreeRecord } from "@agent-mapper/core";
import { GitBranch } from "lucide-react";
import { Button } from "../../ui/button";
import { StateLabel, StateMarker } from "../../ui/marks";
import { PathText } from "../../ui/path-text";
import { DetailPane, EmptyState, ListPane } from "./panes";

const folderName = (path: string) => path.split("/").at(-1) ?? path;

interface CheckoutsProps {
  worktrees: WorktreeRecord[];
  onSelectPath(path: string): void;
}

/** From the main checkout: every linked worktree Git knows about, including stale registrations. */
export function Checkouts({ worktrees, onSelectPath }: CheckoutsProps) {
  const linked = worktrees.filter((tree) => !tree.isMain);
  const [selectedPath, setSelectedPath] = useState<string>();
  const selected =
    linked.find((tree) => tree.path === selectedPath) ?? linked[0];
  if (!linked.length) {
    return worktrees.length ? (
      <EmptyState title="No linked worktrees">
        Git has no other checkout registered for this repository.
      </EmptyState>
    ) : (
      <EmptyState title="No Git repository">
        Select a Git checkout to compare its project configuration.
      </EmptyState>
    );
  }
  return (
    <>
      <ListPane title="Linked worktrees" count={linked.length}>
        {linked.map((tree) => {
          const available = tree.state === "available";
          return (
            <button
              aria-current={tree === selected ? "true" : undefined}
              className={`grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_72px] items-center gap-2.5 px-3 text-left [&+&]:border-t [&+&]:border-wash ${tree === selected ? "bg-selected" : "hover:bg-hover"}`}
              key={tree.path}
              onClick={() => setSelectedPath(tree.path)}
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
                {folderName(tree.path)}
              </span>
              <span className="truncate font-mono text-mono text-ink-faint">
                {tree.branch ?? "detached"}
              </span>
              <StateLabel
                text={available ? undefined : tree.state}
                tier="problem"
              />
            </button>
          );
        })}
      </ListPane>
      {selected ? (
        <DetailPane eyebrow="Worktree" title={folderName(selected.path)}>
          <dl className="m-0 mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-label">
            <dt className="text-ink-muted">Git state</dt>
            <dd className="m-0">{selected.state}</dd>
            <dt className="text-ink-muted">Branch</dt>
            <dd className="m-0 font-mono text-mono">
              {selected.branch ?? "detached or unavailable"}
            </dd>
            <dt className="text-ink-muted">Path</dt>
            <dd className="m-0 font-mono text-mono break-words">
              <PathText path={selected.path} />
            </dd>
          </dl>
          {selected.state === "available" ? (
            <div className="mt-5.5 flex gap-2">
              <Button
                onClick={() => onSelectPath(selected.path)}
                variant="primary"
              >
                Open checkout
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-label text-problem" role="alert">
              Git still lists this checkout, but its folder is unavailable.
              Inspect it with git worktree list.
            </p>
          )}
        </DetailPane>
      ) : null}
    </>
  );
}
