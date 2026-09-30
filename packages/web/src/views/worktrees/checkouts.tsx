import {
  coverageProblems,
  type InventorySnapshot,
  type ToolId,
  type WorktreeDifference,
  type WorktreeRecord
} from "@agent-mapper/core";
import type { Landing } from "../../shell/view-bar";
import { EmptyState } from "../../ui/empty-state";
import type { PathContext } from "../../model/paths";
import { useFolderScans, type FolderScan } from "../../state/use-folder-scans";
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
            status={<DifferenceCount scan={scans.get(tree.path)} tool={tool} />}
            tree={tree}
          />
        ))}
      </ListSection>
    </ListPane>
  );
}
