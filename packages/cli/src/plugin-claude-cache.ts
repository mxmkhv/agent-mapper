import { isAbsolute, join, relative, sep } from "node:path";
import type { PluginRecord, PluginState } from "@agent-mapper/core";
import {
  cache,
  plugin,
  splitKey,
  type PluginSetting
} from "./plugin-reader-common";

const cacheParts = 3;

export function cachePathMatches(options: {
  installPath: string;
  key: string;
  cacheRoot: string;
}): boolean {
  const { installPath, key, cacheRoot } = options;
  if (!isAbsolute(installPath)) {
    return false;
  }
  const path = relative(cacheRoot, installPath);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    return true;
  }
  const parts = path.split(sep);
  const { name, marketplace } = splitKey(key);
  return (
    parts.length === cacheParts &&
    parts[0] === marketplace &&
    parts[1] === name &&
    Boolean(parts[2])
  );
}

function cachedStatus(
  setting: PluginSetting | undefined
): Pick<PluginRecord, "state" | "reason"> {
  if (!setting) {
    return {
      state: "cached",
      reason: "Files are cached; no matching installation record was found."
    };
  }
  if (setting.enabled) {
    return {
      state: "unknown",
      reason:
        "Settings enable this plugin, but this cached copy has no matching installation record."
    };
  }
  return {
    state: "disabled",
    reason:
      "Settings disable this plugin; files remain cached without an installation record."
  };
}

export async function cachedClaudeRecords(options: {
  root: string;
  installed: PluginRecord[];
  settings: Map<string, PluginSetting>;
  errors: string[];
}): Promise<PluginRecord[]> {
  const result: PluginRecord[] = [];
  for (const entry of await cache(
    join(options.root, "cache"),
    options.errors
  )) {
    if (
      options.installed.some(
        (record) =>
          record.installPath === entry.path && record.key === entry.key
      )
    ) {
      continue;
    }
    const setting = options.settings.get(entry.key);
    result.push(
      plugin({
        tool: "claude",
        key: entry.key,
        name: entry.name,
        marketplace: entry.marketplace,
        version: entry.version,
        scope: "global",
        ...cachedStatus(setting),
        installPath: entry.path,
        sourcePath: entry.path,
        settingsEvidence: setting?.path
      })
    );
  }
  return result;
}

export function unmatchedClaudeSettings(options: {
  settings: Map<string, PluginSetting>;
  found: PluginRecord[];
  cacheComplete: boolean;
}): PluginRecord[] {
  const result: PluginRecord[] = [];
  for (const [key, setting] of options.settings) {
    if (options.found.some((record) => record.key === key)) {
      continue;
    }
    let value: PluginState = "disabled";
    if (setting.enabled) {
      value = options.cacheComplete ? "missing" : "unknown";
    }
    let reason =
      "Settings disable this plugin; no installation record or cached files were found.";
    if (setting.enabled) {
      reason = options.cacheComplete
        ? "Settings enable this plugin, but no installation record or cached files were found."
        : "The plugin cache could not be fully read; installation cannot be verified.";
    }
    result.push(
      plugin({
        tool: "claude",
        key,
        ...splitKey(key),
        scope: setting.project ? "project" : "global",
        state: value,
        sourcePath: setting.path,
        settingsEvidence: setting.path,
        reason
      })
    );
  }
  return result;
}
