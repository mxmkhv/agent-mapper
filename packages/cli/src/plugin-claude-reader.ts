import { join } from "node:path";
import type { PluginRecord, PluginState } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import {
  json,
  object,
  plugin,
  splitKey,
  type JsonMap,
  type PluginReaderOptions,
  type PluginSetting
} from "./plugin-reader-common";
import {
  cachePathMatches,
  cachedClaudeRecords,
  unmatchedClaudeSettings
} from "./plugin-claude-cache";

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

function state(
  setting: PluginSetting | undefined,
  scope: PluginRecord["scope"]
): PluginState {
  if (!setting) {
    return "unknown";
  }
  if (!setting.enabled) {
    return "disabled";
  }
  return setting.project || scope !== "global" ? "unknown" : "selected";
}

function reason(options: {
  value: PluginState;
  projectSetting: boolean;
  scope: PluginRecord["scope"];
}): string {
  const { value, projectSetting, scope } = options;
  if (value === "selected") {
    return "Installation record and user setting select this version.";
  }
  if (value === "disabled") {
    return "Installation record exists; settings disable this plugin.";
  }
  if (projectSetting || scope === "project") {
    return "Project plugin selection depends on folder trust, which is not verified.";
  }
  if (scope === "unknown") {
    return "Installation scope is unknown; plugin selection cannot be confirmed.";
  }
  return "Installation is recorded, but enablement is not established.";
}

function installation(options: {
  key: string;
  data: JsonMap;
  installedPath: string;
  cacheRoot: string;
  setting?: PluginSetting;
}): PluginRecord | undefined {
  const { key, data, installedPath, cacheRoot, setting } = options;
  if (typeof data.installPath !== "string") {
    return undefined;
  }
  let scope: PluginRecord["scope"] = "unknown";
  if (data.scope === "project" || data.scope === "local") {
    scope = "project";
  } else if (data.scope === "user") {
    scope = "global";
  }
  let value = state(setting, scope);
  let explanation = reason({
    value,
    projectSetting: setting?.project ?? false,
    scope
  });
  if (
    value !== "disabled" &&
    !cachePathMatches({ installPath: data.installPath, key, cacheRoot })
  ) {
    value = "unknown";
    explanation =
      "Installation path does not match this plugin's cache key; selection cannot be confirmed.";
  }
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
    reason: explanation
  });
}

function applies(data: JsonMap, directory: string): boolean {
  if (
    (data.scope !== "project" && data.scope !== "local") ||
    typeof data.projectPath !== "string"
  ) {
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
  cacheRoot: string;
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
        cacheRoot: options.cacheRoot,
        setting: options.settings.get(key)
      });
      if (record) {
        result.push(record);
      }
    }
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
    cacheRoot: join(root, "cache"),
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
  const found = [
    ...known,
    ...(await cachedClaudeRecords({
      root,
      installed: known,
      settings: applied
    }))
  ];
  return [...found, ...unmatchedClaudeSettings(applied, found)];
}
