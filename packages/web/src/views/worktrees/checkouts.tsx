import {
  coverageProblems,
  type InventorySnapshot,
  type ToolId,
  type WorktreeDifference,
  type WorktreeRecord
} from "@agent-mapper/core";
import { GitBranch } from "lucide-react";
import type { Landing } from "../../shell/view-bar";
import { EmptyState } from "../../ui/empty-state";
import { StateLabel, StateMarker } from "../../ui/marks";
import { tildePath, type PathContext } from "../../model/paths";
import { useFolderScans, type FolderScan } from "../../state/use-folder-scans";
import { relevantDifferences } from "./difference-groups";
import { ListPane, ListSection } from "./panes";

type CheckoutScan = FolderScan<WorktreeDifference[]>;

/** A scan without a comparison compared nothing; its scan problems say why instead of implying no drift. */
function readDifferences(snapshot: InventorySnapshot): CheckoutScan {
  if (snapshot.comparison) {
    return { status: "ready", value: snapshot.comparison.differences };
  }
  const [problem] = coverageProblems(snapshot.coverage);
  return {
    status: "error",
    message:
      problem ??
      "No comparison with the main checkout was returned. Rescan to try again."
  };
}

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
        not compared · rescan
      </span>
    );
  }
  const count = relevantDifferences(scan.value, tool).length;
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
  const scans = useFolderScans(
    {
      paths: linked
        .filter((tree) => tree.state === "available")
        .map((tree) => tree.path),
      refresh: refreshKey
    },
    readDifferences
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
              {available ? (
                <span className="truncate font-mono text-mono text-ink-faint">
                  {tree.branch ? folder : "detached"}
                </span>
              ) : (
                // Git still lists the checkout but its folder is gone; say where to look.
                <span className="truncate text-caption text-ink-muted">
                  Folder unavailable · check git worktree list
                </span>
              )}
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
