import { readFileSync } from "node:fs";

export interface HookInput {
  cwd?: string;
  tool_name?: string;
  tool_input?: { command?: string; file_path?: string };
  stop_hook_active?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readInput(): HookInput {
  const value = JSON.parse(readFileSync(0, "utf8"));
  if (!isRecord(value)) {
    throw new Error("Hook input must be a JSON object.");
  }
  for (const key of ["cwd", "tool_name"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error(`Hook ${key} must be a string.`);
    }
  }
  if (
    value.stop_hook_active !== undefined &&
    typeof value.stop_hook_active !== "boolean"
  ) {
    throw new Error("stop_hook_active must be a boolean.");
  }
  validateToolInput(value.tool_input);
  return value;
}

function validateToolInput(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw new Error("tool_input must be an object.");
  }
  for (const key of ["command", "file_path"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error(`tool_input.${key} must be a string.`);
    }
  }
}

export function report(context: string, stop = false): void {
  const output = stop
    ? { decision: "block", reason: context }
    : {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: context
        }
      };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function patchPaths(command: string): string[] {
  return Array.from(
    command.matchAll(
      /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm
    ),
    (match) => match[1] ?? ""
  );
}
