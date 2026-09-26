import type { ToolId } from "./inventory";

export interface WorktreeRecord {
  path: string;
  isMain: boolean;
  state: "available" | "prunable" | "missing";
  branch?: string;
  head?: string;
}

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
