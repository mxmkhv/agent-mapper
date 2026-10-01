import { dirname, join } from "node:path";
import type {
  AgentRecord,
  HookRecord,
  InventoryEntry,
  PluginRecord
} from "@agent-mapper/core";
import { addGroups, type HookSource } from "./hook-record";
import { addCodexTomlHooks, codexHooksSetting } from "./hook-toml";
import { json, object, type JsonMap } from "./plugin-reader-common";
import { addFrontmatterHooks } from "./hook-frontmatter";
import { addManagedHooks, markManagedHookRestrictions } from "./hook-managed";
import type { ManagedSettingsFile } from "./managed-claude-reader";
import { codexProjectConfigPaths } from "./codex-config-paths";
import type { CodexTomlReader } from "./codex-toml";

function hookMaps(
  data: JsonMap,
  report: (problem: string) => void
): { events: JsonMap; prefix: string }[] {
  const extension = object(object(data.extensions)?.["com.openai"]);
  const value = extension?.hooks ?? data.hooks;
  if (value === undefined) {
    return [];
  }
  const prefix =
    extension?.hooks === undefined ? "hooks" : "extensions.com.openai.hooks";
  const values = Array.isArray(value) ? value : [value];
  const maps: { events: JsonMap; prefix: string }[] = [];
  for (const [index, item] of values.entries()) {
    // A plugin manifest may list hook files by path; those files are read as their own sources.
    if (typeof item === "string") {
      continue;
    }
    const inline = object(item);
    const events = object(inline?.hooks) ?? inline;
    const locator = Array.isArray(value) ? `${prefix}[${index}]` : prefix;
    if (events) {
      maps.push({ events, prefix: locator });
    } else {
      report(`${locator} must be an object of events; it was skipped.`);
    }
  }
  return maps;
}

async function addJson(
  hooks: HookRecord[],
  options: { source: HookSource; errors: string[] }
): Promise<void> {
  const { source, errors } = options;
  const data = await json(source.path, errors);
  if (!data) {
    return;
  }
  const report = (problem: string) => errors.push(`${source.path}: ${problem}`);
  for (const map of hookMaps(data, report)) {
    addGroups(hooks, {
      source: { ...source, locatorPrefix: map.prefix },
      events: map.events,
      errors
    });
  }
}

function directSources(options: {
  claudeConfigDir: string;
  codexHome: string;
  root: string;
  workingDirectory: string;
}): HookSource[] {
  const { claudeConfigDir, codexHome, root } = options;
  return [
    {
      path: join(claudeConfigDir, "settings.json"),
      tool: "claude",
      scope: "global"
    },
    {
      path: join(root, ".claude", "settings.json"),
      tool: "claude",
      scope: "project"
    },
    {
      path: join(root, ".claude", "settings.local.json"),
      tool: "claude",
      scope: "project"
    },
    {
      path: join(codexHome, "hooks.json"),
      tool: "codex",
      scope: "global"
    },
    ...codexProjectConfigPaths(root, options.workingDirectory).map(
      (path): HookSource => ({
        path: join(dirname(path), "hooks.json"),
        tool: "codex",
        scope: "project"
      })
    )
  ];
}

async function addPluginHooks(
  hooks: HookRecord[],
  options: { plugins: PluginRecord[]; errors: string[] }
): Promise<void> {
  for (const plugin of options.plugins) {
    const files = new Set(
      plugin.contributions
        .filter((item) => item.kind === "hook")
        .map((item) => item.sourcePath)
    );
    for (const path of files) {
      await addJson(hooks, {
        source: { path, tool: plugin.tool, scope: plugin.scope, plugin },
        errors: options.errors
      });
    }
  }
}

async function applyClaudeDisabled(
  hooks: HookRecord[],
  sources: HookSource[]
): Promise<void> {
  let disabled: boolean | undefined;
  for (const source of sources.filter((item) => item.tool === "claude")) {
    const settings = await json(source.path, []);
    if (typeof settings?.disableAllHooks === "boolean") {
      disabled = settings.disableAllHooks;
    }
  }
  if (disabled) {
    for (const hook of hooks.filter(
      (item) => item.tool === "claude" && item.scope !== "managed"
    )) {
      hook.availability = "disabled";
      hook.reason = "Claude settings disable hooks for this context.";
    }
  }
}

async function applyCodexDisabled(
  hooks: HookRecord[],
  options: {
    codexHome: string;
    root: string;
    workingDirectory: string;
    toml: CodexTomlReader;
  }
): Promise<void> {
  const userPath = join(options.codexHome, "config.toml");
  const user = await codexHooksSetting(userPath, options.toml);
  let project: boolean | undefined;
  for (const path of codexProjectConfigPaths(
    options.root,
    options.workingDirectory
  )) {
    if (path === userPath) {
      continue;
    }
    const value = await codexHooksSetting(path, options.toml);
    if (value !== undefined) {
      project = value;
    }
  }
  const disabled = user === false && project !== true;
  const uncertain = project === false || (user === false && project === true);
  for (const hook of hooks.filter(
    (item) => item.tool === "codex" && item.availability !== "disabled"
  )) {
    if (disabled) {
      hook.availability = "disabled";
      hook.reason = "Codex user configuration disables hooks.";
    } else if (uncertain) {
      hook.availability = "unknown";
      hook.reason =
        "A project feature setting may change Codex hook enablement if the project is trusted.";
    }
  }
}

export async function scanHooks(options: {
  root: string;
  claudeConfigDir: string;
  codexHome: string;
  workingDirectory: string;
  plugins: PluginRecord[];
  entries: InventoryEntry[];
  agents: AgentRecord[];
  managedSettings: ManagedSettingsFile[];
  contentFor(path: string): string | undefined;
  toml: CodexTomlReader;
}): Promise<{ hooks: HookRecord[]; errors: string[] }> {
  const hooks: HookRecord[] = [];
  const errors: string[] = [];
  const root = options.root;
  const direct = directSources({ ...options, root });
  const seen = new Set<string>();
  for (const source of direct) {
    if (seen.has(source.path)) {
      continue;
    }
    seen.add(source.path);
    await addJson(hooks, { source, errors });
  }
  await addCodexTomlHooks(hooks, { ...options, seen, errors });
  await addPluginHooks(hooks, { plugins: options.plugins, errors });
  addManagedHooks(hooks, { files: options.managedSettings, errors });
  await addFrontmatterHooks(hooks, {
    entries: options.entries,
    agents: options.agents,
    plugins: options.plugins,
    errors,
    contentFor: options.contentFor
  });
  await applyClaudeDisabled(hooks, direct);
  markManagedHookRestrictions(hooks, options.managedSettings);
  await applyCodexDisabled(hooks, {
    codexHome: options.codexHome,
    root,
    workingDirectory: options.workingDirectory,
    toml: options.toml
  });
  return { hooks, errors };
}
