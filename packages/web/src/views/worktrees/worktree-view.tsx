import type {
  ToolId,
  WorktreeComparison,
  WorktreeRecord
} from "@agent-mapper/core";
import { Checkouts } from "./checkouts";
import { Differences } from "./differences";

interface WorktreeViewProps {
  worktrees: WorktreeRecord[];
  comparison?: WorktreeComparison;
  workingDirectory: string;
  tool: ToolId;
  onSelectPath(path: string): void;
}

/** A linked worktree compares itself with the main checkout; the main checkout lists its worktrees. */
export function WorktreeView({
  worktrees,
  comparison,
  workingDirectory,
  tool,
  onSelectPath
}: WorktreeViewProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
      {comparison ? (
        <Differences
          comparison={comparison}
          onSelectPath={onSelectPath}
          tool={tool}
          workingDirectory={workingDirectory}
        />
      ) : (
        <Checkouts onSelectPath={onSelectPath} worktrees={worktrees} />
      )}
    </div>
  );
}
