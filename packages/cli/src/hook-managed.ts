import type { HookRecord } from "@agent-mapper/core";
import type { ManagedSettingsFile } from "./managed-claude-reader";
import { addGroups } from "./hook-record";
import { object } from "./plugin-reader-common";

function lastBoolean(
  files: ManagedSettingsFile[],
  key: "disableAllHooks" | "allowManagedHooksOnly"
): boolean | undefined {
  let value: boolean | undefined;
  for (const file of files) {
    if (typeof file.data[key] === "boolean") {
      value = file.data[key];
    }
  }
  return value;
}

export function addManagedHooks(
  hooks: HookRecord[],
  options: { files: ManagedSettingsFile[]; errors: string[] }
): void {
  for (const file of options.files) {
    for (const key of ["disableAllHooks", "allowManagedHooksOnly"] as const) {
      if (
        Object.hasOwn(file.data, key) &&
        typeof file.data[key] !== "boolean"
      ) {
        options.errors.push(`${file.path}: ${key} must be a boolean.`);
      }
    }
    if (!Object.hasOwn(file.data, "hooks")) {
      continue;
    }
    const events = object(file.data.hooks);
    if (!events) {
      options.errors.push(`${file.path}: Managed hooks must be an event map.`);
      continue;
    }
    addGroups(hooks, {
      source: {
        path: file.path,
        tool: "claude",
        scope: "managed",
        unknownReason:
          "Declared in a local managed file; remote or device policy may take precedence."
      },
      events
    });
  }
}

export function markManagedHookRestrictions(
  hooks: HookRecord[],
  files: ManagedSettingsFile[]
): void {
  if (lastBoolean(files, "disableAllHooks")) {
    for (const hook of hooks.filter((item) => item.tool === "claude")) {
      if (hook.availability !== "disabled") {
        hook.availability = "unknown";
        hook.reason =
          "Local managed settings request disabling all Claude hooks; higher-priority policy selection is not verified.";
      }
    }
    return;
  }
  if (!lastBoolean(files, "allowManagedHooksOnly")) {
    return;
  }
  for (const hook of hooks.filter(
    (item) => item.tool === "claude" && item.scope !== "managed"
  )) {
    if (hook.availability === "disabled") {
      continue;
    }
    if (hook.pluginId) {
      hook.availability = "unknown";
      hook.reason =
        "Local managed settings restrict hooks; force-enabled plugin exceptions are not resolved.";
    } else {
      hook.availability = "unknown";
      hook.reason =
        "Local managed settings request managed hooks only; higher-priority policy selection is not verified.";
    }
  }
}
