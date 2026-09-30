import type { ToolId, WorktreeRecord } from "@agent-mapper/core";
import { GitBranch } from "lucide-react";
import type { Landing } from "../../shell/view-bar";
import { EmptyState } from "../../ui/empty-state";
import { StateLabel, StateMarker } from "../../ui/marks";
import { tildePath, type PathContext } from "../../model/paths";
import { relevantDifferences } from "./difference-groups";
import { ListPane, ListSection } from "./panes";
import {
  useCheckoutDifferences,
  type CheckoutScan
} from "./use-checkout-differences";

const folderName = (path: string) => path.split("/").at(-1) ?? path;

interface CheckoutsProps {
  worktrees: WorktreeRecord[];
  context: PathContext;
  tool: ToolId;
  refreshKey: number;
  onSelectPath(path: string, landing?: Landing): void;
}

function DifferenceCount({
  scan,
  tool
}: {
  scan?: CheckoutScan;
  tool: ToolId;
}) {
  if (!scan) {
    return <span className="text-caption text-ink-faint">…</span>;
  }
  if (scan.status === "error") {
    return (
      <span className="text-caption text-problem" title={scan.message}>
        scan failed
      </span>
    );
  }
  const count = relevantDifferences(scan.differences, tool).length;
  return (
    <span className="text-caption whitespace-nowrap text-ink-muted tabular-nums">
      {count
        ? `${count} ${count === 1 ? "file differs" : "files differ"}`
        : "no differences"}
    </span>
  );
}

/**
 * From the main checkout: every linked worktree Git knows about, including stale registrations. Rows lead with
 * the branch, as the sidebar does, and open that checkout's comparison.
 */
export function Checkouts({
  worktrees,
  context,
  tool,
  refreshKey,
  onSelectPath
}: CheckoutsProps) {
  const linked = worktrees.filter((tree) => !tree.isMain);
  const scans = useCheckoutDifferences(
    linked
      .filter((tree) => tree.state === "available")
      .map((tree) => tree.path),
    refreshKey
  );
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
    <ListPane>
      <ListSection count={linked.length} title="Linked worktrees">
        {linked.map((tree) => {
          const available = tree.state === "available";
          const folder = folderName(tree.path);
          return (
            <button
              className="grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_minmax(0,1fr)_120px] items-center gap-2.5 px-3 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent [&+&]:border-t [&+&]:border-wash"
              disabled={!available}
              key={tree.path}
              onClick={() => onSelectPath(tree.path, { view: "worktrees" })}
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
                {tree.branch ?? folder}
              </span>
              <span className="truncate font-mono text-mono text-ink-faint">
                {tree.branch ? folder : "detached"}
              </span>
              <span className="truncate text-right">
                {available ? (
                  <DifferenceCount scan={scans.get(tree.path)} tool={tool} />
                ) : (
                  <StateLabel text={tree.state} tier="problem" />
                )}
              </span>
            </button>
          );
        })}
      </ListSection>
    </ListPane>
  );
}
