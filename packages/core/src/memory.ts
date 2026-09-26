import type { ToolId } from "./inventory";

export interface MemoryRecord {
  id: string;
  tool: ToolId | "unknown";
  name: string;
  sourcePath: string;
  scope: "global" | "project" | "unknown";
  projectMatch: "matched" | "candidate" | "unmatched" | "not applicable";
  loading: "startup index" | "on demand" | "unknown";
  readState: "readable" | "unreadable";
  sizeBytes?: number;
  lineCount?: number;
  modifiedAt: string;
  reason: string;
  error?: string;
}
