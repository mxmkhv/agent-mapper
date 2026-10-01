import type { ToolId } from "./inventory";

export interface AgentRecord {
  id: string;
  tool: ToolId;
  name: string;
  scope: "global" | "project" | "unknown";
  format: "markdown" | "toml";
  sourcePath: string;
  /** Where the file really is, when `sourcePath` reaches it through a symlink. */
  realPath?: string;
  locator: string;
  descriptionPresent: boolean;
  characters?: number;
  readState: "readable" | "unreadable";
  availability: "configured" | "shadowed" | "unknown";
  reason: string;
  /** Id of the nearer agent that takes precedence, when a single one does. It may itself be shadowed. */
  shadowedBy?: string;
  pluginId?: string;
}
