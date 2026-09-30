import type {
  ToolId,
  WorktreeComparison,
  WorktreeRecord
} from "@agent-mapper/core";
import type { PathContext } from "../../model/paths";
import type { Landing } from "../../shell/view-bar";
import { Checkouts } from "./checkouts";
import { Differences } from "./differences";

interface WorktreeViewProps {
  worktrees: WorktreeRecord[];
  comparison?: WorktreeComparison;
  workingDirectory: string;
  context: PathContext;
  tool: ToolId;
  refreshKey: number;
  onSelectPath(path: string, landing?: Landing): void;
}

/** A linked worktree compares itself with the main checkout; the main checkout lists its worktrees. */
export function WorktreeView(props: WorktreeViewProps) {
  return props.comparison ? (
    <Differences
      comparison={props.comparison}
      context={props.context}
      onSelectPath={props.onSelectPath}
      tool={props.tool}
      workingDirectory={props.workingDirectory}
    />
  ) : (
    <Checkouts
      context={props.context}
      onSelectPath={props.onSelectPath}
      refreshKey={props.refreshKey}
      tool={props.tool}
      worktrees={props.worktrees}
    />
  );
}
