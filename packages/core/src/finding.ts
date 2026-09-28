import type { ToolId } from "./inventory";

export type FindingCode =
  | "broken-symlink"
  | "unreadable-source"
  | "shadowed-source"
  | "long-instruction"
  | "repeated-instruction"
  | "missing-import"
  | "missing-plugin";

export interface FindingSource {
  id: string;
  path: string;
}

export interface Finding {
  id: string;
  tool: ToolId;
  code: FindingCode;
  level: "problem" | "information" | "review" | "coverage";
  title: string;
  reason: string;
  sources: FindingSource[];
}
