import type { ToolId } from "./inventory";

export interface McpRecord {
  id: string;
  tool: ToolId;
  name: string;
  scope: "managed" | "global" | "project" | "unknown";
  sourcePath: string;
  locator: string;
  transport: "stdio" | "http" | "sse" | "ws" | "unknown";
  destination: string;
  envNames: string[];
  headerNames: string[];
  pluginId?: string;
  availability:
    "configured" | "disabled" | "shadowed" | "approval required" | "unknown";
  reason: string;
  /** Id of the declaration that takes precedence over this one, when a single declaration wins. */
  shadowedBy?: string;
}
