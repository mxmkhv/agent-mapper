import type { ToolId } from "./inventory";

export interface WorktreeRecord {
  path: string;
  isMain: boolean;
  state: "available" | "prunable" | "missing" | "unknown";
  branch?: string;
  head?: string;
}

/** The pull request that best describes a branch: open or draft first, then merged, then closed; newest within each. */
export interface PullRequestSummary {
  number: number;
  state: "open" | "draft" | "merged" | "closed";
  title: string;
  url: string;
}

/** Head branch name → its pull request. */
export type PullRequestsByBranch = Record<string, PullRequestSummary>;

/** Pull requests by head branch name, or why GitHub could not be asked. */
export type PullRequestLookup =
  | {
      status: "ready";
      byBranch: PullRequestsByBranch;
      /** gh hit its list limit, so older branches may have no badge. */
      truncated: boolean;
    }
  | { status: "unavailable"; reason: string };

export interface ComparisonSide {
  id: string;
  path: string;
  tracking: "tracked" | "not tracked" | "unknown";
  readState: "readable" | "unreadable";
}

export interface WorktreeDifference {
  id: string;
  relativePath: string;
  kind:
    | "instruction"
    | "skill"
    | "command"
    | "agent"
    | "hook"
    | "plugin"
    | "mcp"
    | "settings";
  tool: ToolId | "shared";
  state: "only-main" | "only-here" | "different-content" | "unknown";
  main?: ComparisonSide;
  here?: ComparisonSide;
}

export interface WorktreeComparison {
  mainPath: string;
  herePath: string;
  differences: WorktreeDifference[];
}
