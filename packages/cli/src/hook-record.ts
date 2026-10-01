import { createHash } from "node:crypto";
import type {
  HookLane,
  HookRecord,
  PluginRecord,
  ToolId
} from "@agent-mapper/core";
import { hookPreview } from "./hook-preview";
import { object, type JsonMap } from "./plugin-reader-common";

export interface HookSource {
  path: string;
  tool: ToolId;
  scope: HookRecord["scope"];
  plugin?: PluginRecord;
  condition?: string;
  disabled?: boolean;
  unknownReason?: string;
  locatorPrefix?: string;
}

function lane(event: string): HookLane {
  const known = {
    SessionStart: "Session start",
    Setup: "Session start",
    UserPromptSubmit: "Prompt submit",
    UserPromptExpansion: "Prompt submit",
    PreToolUse: "Before tool",
    PermissionRequest: "Permission",
    PermissionDenied: "Permission",
    PostToolUse: "After tool",
    PostToolUseFailure: "After tool",
    PostToolBatch: "After tool",
    SubagentStart: "Subagent",
    SubagentStop: "Subagent",
    PreCompact: "Compact",
    PostCompact: "Compact",
    Stop: "Stop",
    StopFailure: "Stop",
    SessionEnd: "Session end"
  } satisfies Record<string, HookLane>;
  return known[event as keyof typeof known] ?? "Other";
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const maxMatcherLength = 120;

function visibleMatcher(value: unknown): string | undefined {
  const matcher = string(value);
  if (!matcher) {
    return undefined;
  }
  return matcher.length <= maxMatcherLength &&
    /^[A-Za-z0-9_.*|^$()?,-]+$/.test(matcher)
    ? matcher
    : "hidden; open source";
}

function flags(handler: JsonMap): string[] {
  const result: string[] = [];
  if (handler.async === true) {
    result.push("async");
  }
  if (typeof handler.timeout === "number") {
    result.push(`timeout: ${handler.timeout}`);
  }
  if (handler.once === true) {
    result.push("once");
  }
  return result;
}

function availability(
  source: HookSource
): Pick<HookRecord, "availability" | "reason"> {
  if (source.disabled || source.plugin?.state === "disabled") {
    return {
      availability: "disabled",
      reason: "Hooks are disabled by local settings or the parent plugin."
    };
  }
  if (source.plugin && source.plugin.state !== "selected") {
    return {
      availability: "unknown",
      reason: `Parent plugin is ${source.plugin.state}; this hook is a candidate declaration.`
    };
  }
  if (source.tool === "codex") {
    return {
      availability: "unknown",
      reason:
        "Codex hook trust and active session flags are not verified. Review in /hooks."
    };
  }
  if (source.unknownReason) {
    return { availability: "unknown", reason: source.unknownReason };
  }
  if (source.condition) {
    return { availability: "conditional", reason: source.condition };
  }
  return {
    availability: "configured",
    reason:
      "Declared in local configuration; live session state is not verified."
  };
}

interface HookInput {
  source: HookSource;
  event: string;
  group: JsonMap;
  groupIndex: number;
  handler: JsonMap;
  handlerIndex: number;
}
const idLength = 20;

function append(hooks: HookRecord[], input: HookInput): void {
  const { source, event, group, groupIndex, handler, handlerIndex } = input;
  const locator = `${source.locatorPrefix ?? "hooks"}.${event}[${groupIndex}].hooks[${handlerIndex}]`;
  const id = createHash("sha256")
    .update(
      `${source.tool}:${source.path}:${locator}:${source.plugin?.id ?? ""}`
    )
    .digest("hex")
    .slice(0, idLength);
  const record: HookRecord = {
    id,
    tool: source.tool,
    event,
    lane: lane(event),
    handlerType: ["command", "http", "mcp_tool", "prompt", "agent"].includes(
      string(handler.type) ?? ""
    )
      ? (string(handler.type) ?? "unknown")
      : "unknown",
    locator,
    sourcePath: source.path,
    scope: source.scope,
    flags: flags(handler),
    ...availability(source)
  };
  const matcher = visibleMatcher(group.matcher);
  if (matcher) {
    record.matcher = matcher;
  }
  const preview = hookPreview(handler);
  if (preview) {
    record.preview = preview;
  }
  if (source.plugin) {
    record.pluginId = source.plugin.id;
  }
  if (source.condition) {
    record.condition = source.condition;
  }
  hooks.push(record);
  const contribution = source.plugin?.contributions.find(
    (item) =>
      item.kind === "hook" &&
      item.name === event &&
      item.sourcePath === source.path
  );
  if (contribution && !contribution.entryId) {
    contribution.entryId = id;
  }
}

/**
 * Adds every handler in an event map. A declaration of the wrong shape is skipped but reported in `errors`, so a
 * hook that will not run never disappears without a trace.
 */
export function addGroups(
  hooks: HookRecord[],
  options: { source: HookSource; events?: JsonMap; errors: string[] }
): void {
  const { source, events, errors } = options;
  const prefix = source.locatorPrefix ?? "hooks";
  for (const [event, value] of Object.entries(events ?? {})) {
    if (!Array.isArray(value)) {
      errors.push(
        `${source.path}: ${prefix}.${event} must be a list of matcher groups; it was skipped.`
      );
      continue;
    }
    for (const [groupIndex, rawGroup] of value.entries()) {
      const group = object(rawGroup);
      if (!group || !Array.isArray(group.hooks)) {
        errors.push(
          `${source.path}: ${prefix}.${event}[${groupIndex}] must be an object with a hooks list; it was skipped.`
        );
        continue;
      }
      for (const [handlerIndex, rawHandler] of group.hooks.entries()) {
        const handler = object(rawHandler);
        if (!handler) {
          errors.push(
            `${source.path}: ${prefix}.${event}[${groupIndex}].hooks[${handlerIndex}] must be an object; it was skipped.`
          );
          continue;
        }
        append(hooks, {
          source,
          event,
          group,
          groupIndex,
          handler,
          handlerIndex
        });
      }
    }
  }
}
