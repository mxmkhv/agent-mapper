import { join } from "node:path";
import type { PluginRecord, PluginState } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import {
  cache,
  json,
  object,
  plugin,
  splitKey,
  type JsonMap,
  type PluginReaderOptions,
  type PluginSetting
} from "./plugin-reader-common";

const installedRecordVersion = 2;

async function settings(options: {
  path: string;
  project: boolean;
  errors: string[];
}): Promise<Map<string, PluginSetting>> {
  const content = await json(options.path, options.errors);
  const values = object(content?.enabledPlugins);
  const result = new Map<string, PluginSetting>();
  for (const [key, enabled] of Object.entries(values ?? {})) {
    if (typeof enabled === "boolean") {
      result.set(key, {
        enabled,
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
    path: join(options.home, ".claude", "settings.json"),
    project: false,
    errors
  });
  if (root === options.home) {
    return result;
  }
  for (const file of ["settings.json", "settings.local.json"]) {
    for (const [key, value] of await settings({
      path: join(root, ".claude", file),
      project: true,
      errors
    })) {
      result.set(key, value);
    }
  }
  return result;
}

function state(setting: PluginSetting | undefined): PluginState {
  if (!setting) {
    return "unknown";
  }
  if (!setting.enabled) {
    return "disabled";
  }
  return setting.project ? "unknown" : "selected";
}

function reason(value: PluginState, projectSetting: boolean): string {
  if (value === "selected") {
    return "Installation record and user setting select this version.";
  }
  if (value === "disabled") {
    return "Installation record exists; settings disable this plugin.";
  }
  if (projectSetting) {
    return "Project setting found; folder trust and runtime selection are not verified.";
  }
  return "Installation is recorded, but enablement is not established.";
}

function installation(options: {
  key: string;
  data: JsonMap;
  installedPath: string;
  setting?: PluginSetting;
}): PluginRecord | undefined {
  const { key, data, installedPath, setting } = options;
  if (typeof data.installPath !== "string") {
    return undefined;
  }
  let scope: PluginRecord["scope"] = "unknown";
  if (data.scope === "project") {
    scope = "project";
  } else if (data.scope === "user") {
    scope = "global";
  }
  const value = state(setting);
  return plugin({
    tool: "claude",
    key,
    ...splitKey(key),
    scope,
    state: value,
    version: typeof data.version === "string" ? data.version : undefined,
    installPath: data.installPath,
    sourcePath: data.installPath,
    projectPath:
      typeof data.projectPath === "string" ? data.projectPath : undefined,
    installationEvidence: installedPath,
    settingsEvidence: setting?.path,
    reason: reason(value, setting?.project ?? false)
  });
}

function applies(data: JsonMap, directory: string): boolean {
  if (data.scope !== "project" || typeof data.projectPath !== "string") {
    return true;
  }
  return (
    directory === data.projectPath ||
    directory.startsWith(`${data.projectPath}/`)
  );
}

function installedRecords(options: {
  records?: JsonMap;
  directory: string;
  installedPath: string;
  settings: Map<string, PluginSetting>;
}): PluginRecord[] {
  const result: PluginRecord[] = [];
  for (const [key, value] of Object.entries(options.records ?? {})) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const item of value) {
      const data = object(item);
      if (!data || !applies(data, options.directory)) {
        continue;
      }
      const record = installation({
        key,
        data,
        installedPath: options.installedPath,
        setting: options.settings.get(key)
      });
      if (record) {
        result.push(record);
      }
    }
  }
  return result;
}

async function cachedRecords(
  root: string,
  installed: PluginRecord[]
): Promise<PluginRecord[]> {
  const result: PluginRecord[] = [];
  for (const entry of await cache(join(root, "cache"))) {
    if (installed.some((record) => record.installPath === entry.path)) {
      continue;
    }
    result.push(
      plugin({
        tool: "claude",
        key: entry.key,
        name: entry.name,
        marketplace: entry.marketplace,
        version: entry.version,
        scope: "global",
        state: "cached",
        installPath: entry.path,
        sourcePath: entry.path,
        reason: "Files are cached; no matching installation record was found."
      })
    );
  }
  return result;
}

function missingRecords(
  settingsMap: Map<string, PluginSetting>,
  found: PluginRecord[]
): PluginRecord[] {
  const result: PluginRecord[] = [];
  for (const [key, setting] of settingsMap) {
    if (found.some((record) => record.key === key)) {
      continue;
    }
    result.push(
      plugin({
        tool: "claude",
        key,
        ...splitKey(key),
        scope: setting.project ? "project" : "global",
        state: "missing",
        sourcePath: setting.path,
        settingsEvidence: setting.path,
        reason:
          "Settings mention this plugin, but no installation record or cached files were found."
      })
    );
  }
  return result;
}

export async function readClaudePlugins(
  options: PluginReaderOptions,
  errors: string[]
): Promise<PluginRecord[]> {
  const root = join(options.home, ".claude", "plugins");
  const installedPath = join(root, "installed_plugins.json");
  const installed = await json(installedPath, errors);
  if (installed && installed.version !== installedRecordVersion) {
    errors.push(`${installedPath}: Unsupported installation record version.`);
  }
  const applied = await appliedSettings(options, errors);
  const known = installedRecords({
    records:
      installed?.version === installedRecordVersion
        ? object(installed.plugins)
        : undefined,
    directory: options.workingDirectory,
    installedPath,
    settings: applied
  });
  for (const record of known) {
    if (
      record.state === "selected" &&
      known.filter((item) => item.key === record.key).length > 1
    ) {
      record.state = "unknown";
      record.reason =
        "Several installation records match this plugin; the selected version is unknown.";
    }
  }
  const found = [...known, ...(await cachedRecords(root, known))];
  return [...found, ...missingRecords(applied, found)];
}
