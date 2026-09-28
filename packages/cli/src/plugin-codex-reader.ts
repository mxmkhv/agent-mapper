import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginRecord, PluginState } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import { codexProjectConfigPaths } from "./codex-config-paths";
import {
  cache,
  plugin,
  splitKey,
  type CachedPlugin,
  type PluginReaderOptions,
  type PluginSetting
} from "./plugin-reader-common";

async function settings(options: {
  path: string;
  project: boolean;
  errors: string[];
}): Promise<Map<string, PluginSetting>> {
  let source: string;
  try {
    source = await readFile(options.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      options.errors.push(`${options.path}: Could not read settings.`);
    }
    return new Map();
  }
  const result = new Map<string, PluginSetting>();
  let key: string | undefined;
  for (const line of source.split(/\r?\n/)) {
    const heading = /^\s*\[plugins\."([^"]+)"\]\s*(?:#.*)?$/.exec(line);
    if (heading) {
      key = heading[1];
      continue;
    }
    if (/^\s*\[/.test(line)) {
      key = undefined;
      continue;
    }
    const enabled = /^\s*enabled\s*=\s*(true|false)\s*(?:#.*)?$/.exec(line);
    if (key && enabled) {
      result.set(key, {
        enabled: enabled[1] === "true",
        path: options.path,
        project: options.project
      });
    }
  }
  return result;
}

async function appliedSettings(
  options: PluginReaderOptions,
  errors: string[]
): Promise<Map<string, PluginSetting>> {
  const root =
    (await findGitRoot(options.workingDirectory, "/")) ??
    options.workingDirectory;
  const result = await settings({
    path: join(options.codexHome, "config.toml"),
    project: false,
    errors
  });
  const userPath = join(options.codexHome, "config.toml");
  for (const path of codexProjectConfigPaths(root, options.workingDirectory)) {
    if (path === userPath) {
      continue;
    }
    for (const [key, value] of await settings({
      path,
      project: true,
      errors
    })) {
      result.set(key, value);
    }
  }
  return result;
}

function state(
  setting: PluginSetting | undefined,
  versions: number
): PluginState {
  if (!setting) {
    return "cached";
  }
  if (!setting.enabled) {
    return setting.project ? "unknown" : "disabled";
  }
  return setting.project || versions > 1 ? "unknown" : "selected";
}

function reason(value: PluginState, setting?: PluginSetting): string {
  if (value === "selected") {
    return "One cached version matches an enabled user setting.";
  }
  if (value === "disabled") {
    return "A setting disables this cached plugin.";
  }
  if (value === "cached") {
    return "Files are cached; no enablement setting was found.";
  }
  if (setting?.project && !setting.enabled) {
    return "Project setting disables this plugin if trusted; project trust is not verified.";
  }
  return "Version selection or project trust cannot be confirmed from local settings.";
}

function cachedRecord(options: {
  entry: CachedPlugin;
  all: CachedPlugin[];
  setting?: PluginSetting;
  workingDirectory: string;
}): PluginRecord {
  const { entry, all, setting, workingDirectory } = options;
  const versions = all.filter((item) => item.key === entry.key).length;
  const value = state(setting, versions);
  return plugin({
    tool: "codex",
    key: entry.key,
    name: entry.name,
    marketplace: entry.marketplace,
    version: entry.version,
    scope: setting?.project ? "project" : "global",
    state: value,
    projectPath: setting?.project ? workingDirectory : undefined,
    installPath: entry.path,
    sourcePath: entry.path,
    settingsEvidence: setting?.path,
    reason: reason(value, setting)
  });
}

function missingRecords(
  settingsMap: Map<string, PluginSetting>,
  cached: CachedPlugin[]
): PluginRecord[] {
  const result: PluginRecord[] = [];
  for (const [key, setting] of settingsMap) {
    if (cached.some((entry) => entry.key === key)) {
      continue;
    }
    result.push(
      plugin({
        tool: "codex",
        key,
        ...splitKey(key),
        scope: setting.project ? "project" : "global",
        state: "missing",
        sourcePath: setting.path,
        settingsEvidence: setting.path,
        reason:
          "Settings mention this plugin, but no installed cache copy was found."
      })
    );
  }
  return result;
}

export async function readCodexPlugins(
  options: PluginReaderOptions,
  errors: string[]
): Promise<PluginRecord[]> {
  const applied = await appliedSettings(options, errors);
  const cached = await cache(join(options.codexHome, "plugins", "cache"));
  const found = cached.map((entry) =>
    cachedRecord({
      entry,
      all: cached,
      setting: applied.get(entry.key),
      workingDirectory: options.workingDirectory
    })
  );
  return [...found, ...missingRecords(applied, cached)];
}
