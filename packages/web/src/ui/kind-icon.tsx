import { PixelIcon, type PixelIconName } from "./pixel-icon";
import type { RecordKind } from "../model/record-types";

const icons = {
  instruction: "doc",
  skill: "bolt",
  command: "terminal",
  agent: "bot",
  hook: "hook",
  mcp: "server",
  memory: "database",
  plugin: "plug"
} satisfies Record<RecordKind, PixelIconName>;

export const kindLabel = {
  instruction: "Instructions",
  skill: "Skills",
  command: "Commands",
  agent: "Agents",
  hook: "Hooks",
  mcp: "MCP servers",
  memory: "Memory",
  plugin: "Plugins"
} satisfies Record<RecordKind, string>;

export const kindSingular = {
  instruction: "Instruction",
  skill: "Skill",
  command: "Command",
  agent: "Agent",
  hook: "Hook",
  mcp: "MCP server",
  memory: "Memory file",
  plugin: "Plugin"
} satisfies Record<RecordKind, string>;

export const kindOrder: readonly RecordKind[] = [
  "instruction",
  "skill",
  "command",
  "agent",
  "hook",
  "mcp",
  "memory",
  "plugin"
];

/** Takes the colour of the text around it, so it inverts with a selected row. */
export function KindIcon({ kind }: { kind: RecordKind }) {
  return <PixelIcon name={icons[kind]} />;
}
