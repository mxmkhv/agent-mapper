import {
  Bot,
  Database,
  FileText,
  Plug,
  Server,
  SquareTerminal,
  Webhook,
  Zap,
  type LucideIcon
} from "lucide-react";
import type { RecordKind } from "../model/record-types";

const icons = {
  instruction: FileText,
  skill: Zap,
  command: SquareTerminal,
  agent: Bot,
  hook: Webhook,
  mcp: Server,
  memory: Database,
  plugin: Plug
} satisfies Record<RecordKind, LucideIcon>;

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

export function KindIcon({
  kind,
  small
}: {
  kind: RecordKind;
  small?: boolean;
}) {
  const Icon = icons[kind];
  return (
    <Icon
      aria-hidden="true"
      className={`shrink-0 text-ink-muted ${small ? "size-3.5" : "size-4"}`}
      strokeWidth={1.6}
    />
  );
}
