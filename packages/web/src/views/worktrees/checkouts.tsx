import {
  coverageProblems,
  pullRequestFor,
  type InventorySnapshot,
  type ToolId,
  type WorktreeDifference,
  type WorktreeRecord
} from "@agent-mapper/core";
import type { Landing } from "../../shell/view-bar";
import { EmptyState } from "../../ui/empty-state";
import type { PathContext } from "../../model/paths";
import {
  useFolderScans,
  type FolderResult,
  type FolderScan
} from "../../state/use-folder-scans";
import { usePullRequests } from "../../state/use-pull-requests";
import { CheckoutRow } from "./checkout-row";
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

interface CheckoutsProps {
  worktrees: WorktreeRecord[];
  context: PathContext;
  tool: ToolId;
  refreshKey: number;
  onSelectPath(path: string, landing?: Landing): void;
  onRemoved(): void;
}

function DifferenceCount({
  scan,
  tool
}: {
  scan?: FolderResult<WorktreeDifference[]>;
  tool: ToolId;
}) {
  if (!scan) {
    return <span className="text-caption text-ink-faint">…</span>;
  }
  // A rescan keeps the previous answer in place, faded, until the new one arrives.
  const stale = scan.refreshing ? "opacity-40" : "";
  if (scan.status === "error") {
    return (
      <span
        className={`text-caption text-problem ${stale}`}
        title={scan.refreshing ? "Rescanning" : scan.message}
      >
        not compared · rescan
      </span>
    );
  }
  const count = relevantDifferences(scan.value, tool).length;
  return (
    <span
      className={`text-caption whitespace-nowrap text-ink-muted ${stale}`}
      title={scan.refreshing ? "Rescanning" : undefined}
    >
      {count
        ? `${count} ${count === 1 ? "file differs" : "files differ"}`
        : "no differences"}
    </span>
  );
}

/** Why pull requests are missing or incomplete; silent while loading or when every PR is listed. */
function PullRequestHint({
  state
}: {
  state: ReturnType<typeof usePullRequests>;
}) {
  if (state.status === "error") {
    return (
      <p className="m-0 text-caption text-problem" role="alert">
        Could not load pull requests: {state.message}
      </p>
    );
  }
  if (state.status !== "done") {
    return null;
  }
  const { lookup } = state;
  let message: string | undefined;
  if (lookup.status === "unavailable") {
    message = `Pull requests: ${lookup.reason}`;
  } else if (lookup.truncated) {
    message =
      "Showing the newest 200 pull requests; branches with older ones have no badge.";
  }
  return message ? (
    <p className="m-0 text-caption text-ink-muted">{message}</p>
  ) : null;
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
  onSelectPath,
  onRemoved
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
  const main = worktrees.find((tree) => tree.isMain)?.path;
  const pullRequests = usePullRequests(main, refreshKey);
  const byBranch =
    pullRequests.status === "done" && pullRequests.lookup.status === "ready"
      ? pullRequests.lookup.byBranch
      : {};
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
        {linked.map((tree) => (
          <CheckoutRow
            context={context}
            key={tree.path}
            onOpen={() => onSelectPath(tree.path, { view: "worktrees" })}
            onRemoved={onRemoved}
            repository={main}
            pullRequest={
              tree.branch ? pullRequestFor(byBranch, tree.branch) : undefined
            }
            status={<DifferenceCount scan={scans.get(tree.path)} tool={tool} />}
            tree={tree}
          />
        ))}
      </ListSection>
      <PullRequestHint state={pullRequests} />
    </ListPane>
  );
}
