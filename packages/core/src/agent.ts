import type { ToolId } from "./inventory";

export interface AgentRecord {
  id: string;
  tool: ToolId;
  name: string;
  scope: "global" | "project" | "unknown";
  format: "markdown" | "toml";
  sourcePath: string;
  locator: string;
  descriptionPresent: boolean;
  characters?: number;
  readState: "readable" | "unreadable";
  availability: "configured" | "shadowed" | "unknown";
  reason: string;
  pluginId?: string;
}
