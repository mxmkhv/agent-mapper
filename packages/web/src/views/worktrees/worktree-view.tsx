import type {
  ToolId,
  WorktreeComparison,
  WorktreeRecord
} from "@agent-mapper/core";
import type { PathContext } from "../../model/paths";
import { Checkouts } from "./checkouts";
import { Differences } from "./differences";

interface WorktreeViewProps {
  worktrees: WorktreeRecord[];
  comparison?: WorktreeComparison;
  workingDirectory: string;
  context: PathContext;
  tool: ToolId;
  onSelectPath(path: string): void;
}

/** A linked worktree compares itself with the main checkout; the main checkout lists its worktrees. */
export function WorktreeView({
  worktrees,
  comparison,
  workingDirectory,
  context,
  tool,
  onSelectPath
}: WorktreeViewProps) {
  return (
    // Narrow windows stack the detail under the list instead of squeezing both columns.
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      {comparison ? (
        <Differences
          comparison={comparison}
          onSelectPath={onSelectPath}
          tool={tool}
          workingDirectory={workingDirectory}
        />
      ) : (
        <Checkouts
          context={context}
          onSelectPath={onSelectPath}
          worktrees={worktrees}
        />
      )}
    </div>
  );
}
