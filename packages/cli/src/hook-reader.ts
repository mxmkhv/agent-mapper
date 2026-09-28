import { join } from "node:path";
import type { HookRecord, PluginRecord } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import { addGroups, type HookSource } from "./hook-record";
import { addToml, codexHooksDisabled } from "./hook-toml";
import { json, object, type JsonMap } from "./plugin-reader-common";

function hookMaps(data: JsonMap): { events: JsonMap; prefix: string }[] {
  const extension = object(object(data.extensions)?.["com.openai"]);
  const value = extension?.hooks ?? data.hooks;
  const prefix =
    extension?.hooks === undefined ? "hooks" : "extensions.com.openai.hooks";
  const values = Array.isArray(value) ? value : [value];
  const maps: { events: JsonMap; prefix: string }[] = [];
  for (const [index, item] of values.entries()) {
    const inline = object(item);
    const events = object(inline?.hooks) ?? inline;
    if (events) {
      maps.push({
        events,
        prefix: Array.isArray(value) ? `${prefix}[${index}]` : prefix
      });
    }
  }
  return maps;
}

async function addJson(
  hooks: HookRecord[],
  options: { source: HookSource; errors: string[] }
): Promise<void> {
  const data = await json(options.source.path, options.errors);
  if (!data) {
    return;
  }
  for (const map of hookMaps(data)) {
    addGroups(hooks, {
      source: { ...options.source, locatorPrefix: map.prefix },
      events: map.events
    });
  }
}

function directSources(options: {
  claudeConfigDir: string;
  codexHome: string;
  root: string;
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
    {
      path: join(root, ".codex", "hooks.json"),
      tool: "codex",
      scope: "project"
    }
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
    for (const hook of hooks.filter((item) => item.tool === "claude")) {
      hook.availability = "disabled";
      hook.reason = "Claude settings disable hooks for this context.";
    }
  }
}

async function applyCodexDisabled(
  hooks: HookRecord[],
  codexHome: string
): Promise<void> {
  if (!(await codexHooksDisabled(join(codexHome, "config.toml")))) {
    return;
  }
  for (const hook of hooks.filter((item) => item.tool === "codex")) {
    hook.availability = "disabled";
    hook.reason = "Codex user configuration disables hooks.";
  }
}

export async function scanHooks(options: {
  claudeConfigDir: string;
  codexHome: string;
  workingDirectory: string;
  plugins: PluginRecord[];
}): Promise<{ hooks: HookRecord[]; errors: string[] }> {
  const hooks: HookRecord[] = [];
  const errors: string[] = [];
  const root =
    (await findGitRoot(options.workingDirectory, "/")) ??
    options.workingDirectory;
  const direct = directSources({ ...options, root });
  const seen = new Set<string>();
  for (const source of direct) {
    if (seen.has(source.path)) {
      continue;
    }
    seen.add(source.path);
    await addJson(hooks, { source, errors });
  }
  for (const source of [
    {
      path: join(options.codexHome, "config.toml"),
      tool: "codex" as const,
      scope: "global" as const
    },
    {
      path: join(root, ".codex", "config.toml"),
      tool: "codex" as const,
      scope: "project" as const
    }
  ]) {
    if (seen.has(source.path)) {
      continue;
    }
    seen.add(source.path);
    await addToml(hooks, { source, errors });
  }
  await addPluginHooks(hooks, { plugins: options.plugins, errors });
  await applyClaudeDisabled(hooks, direct);
  await applyCodexDisabled(hooks, options.codexHome);
  return { hooks, errors };
}
