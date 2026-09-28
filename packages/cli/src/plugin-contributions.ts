import { basename, join, resolve } from "node:path";
import type { PluginRecord } from "@agent-mapper/core";
import { json, object, type JsonMap } from "./plugin-reader-common";
import {
  addContribution,
  fileExists,
  paths,
  safePath,
  skillFiles
} from "./plugin-contribution-utils";
import { SourceCollector } from "./source-reader";
import { addPluginCommands } from "./plugin-command-contributions";
import { addAgents } from "./plugin-agent-contributions";

async function addSkills(
  record: PluginRecord,
  options: { manifest: JsonMap; collector?: SourceCollector; errors: string[] }
): Promise<void> {
  const root = record.installPath;
  if (!root) {
    return;
  }
  const directories = ["./skills", ...paths(options.manifest.skills)];
  for (const relative of directories) {
    const directory = await safePath(root, relative);
    if (!directory) {
      continue;
    }
    for (const path of await skillFiles(directory, options.errors)) {
      if (!(await fileExists(path))) {
        continue;
      }
      if (!(await safePath(root, `./${path.slice(root.length + 1)}`))) {
        continue;
      }
      const name = basename(resolve(path, ".."));
      addContribution(record.contributions, {
        kind: "skill",
        name,
        sourcePath: path
      });
      if (record.state === "selected" && options.collector) {
        await options.collector.add({
          tool: record.tool,
          kind: "skill",
          path,
          scope: record.scope,
          projectPath: record.projectPath,
          pluginId: record.id
        });
        const entry = options.collector.entries.find(
          (item) => item.pluginId === record.id && item.path === path
        );
        const contribution = record.contributions.find(
          (item) => item.kind === "skill" && item.sourcePath === path
        );
        if (entry && contribution) {
          contribution.entryId = entry.id;
        }
      }
    }
  }
}

async function addMap(
  record: PluginRecord,
  options: { path: string; kind: "hook" | "mcp"; errors: string[] }
): Promise<void> {
  const data = await json(options.path, options.errors);
  const entries =
    options.kind === "mcp"
      ? object(data?.mcpServers)
      : (object(data?.hooks) ?? data);
  for (const name of Object.keys(entries ?? {})) {
    addContribution(record.contributions, {
      kind: options.kind,
      name,
      sourcePath: options.path
    });
  }
}

async function addConfiguredMaps(
  record: PluginRecord,
  options: { manifest: JsonMap; sourcePath: string; errors: string[] }
): Promise<void> {
  const root = record.installPath;
  if (!root) {
    return;
  }
  for (const [field, kind] of [
    ["hooks", "hook"],
    ["mcpServers", "mcp"]
  ] as const) {
    const value = options.manifest[field];
    if (value === undefined) {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === "string") {
        const path = await safePath(root, item);
        if (path) {
          await addMap(record, { path, kind, errors: options.errors });
        }
      } else {
        for (const name of Object.keys(object(item) ?? {})) {
          addContribution(record.contributions, {
            kind,
            name,
            sourcePath: options.sourcePath
          });
        }
      }
    }
  }
}

interface Manifests {
  components: JsonMap;
  configured: JsonMap;
  configuredPath: string;
}

function selectedManifests(options: {
  record: PluginRecord;
  portable?: JsonMap;
  native?: JsonMap;
  nativePath: string;
}): Manifests {
  const { record, portable, native, nativePath } = options;
  if (portable && record.tool === "codex") {
    const overlay = object(object(portable.extensions)?.["com.openai"]);
    return {
      components: portable,
      configured: overlay ?? native ?? {},
      configuredPath: overlay ? record.sourcePath : nativePath
    };
  }
  return {
    components: portable ?? native ?? {},
    configured: portable ?? native ?? {},
    configuredPath: record.sourcePath
  };
}

async function readManifest(
  record: PluginRecord,
  errors: string[]
): Promise<Manifests> {
  const root = record.installPath ?? record.sourcePath;
  const portable = await json(join(root, "plugin.json"), errors);
  const nativePath = join(
    root,
    record.tool === "claude"
      ? ".claude-plugin/plugin.json"
      : ".codex-plugin/plugin.json"
  );
  const native = await json(nativePath, errors);
  if (portable) {
    record.sourcePath = join(root, "plugin.json");
  } else if (native || (await fileExists(nativePath))) {
    record.sourcePath = nativePath;
  }
  return selectedManifests({ record, portable, native, nativePath });
}

export async function inspectPlugin(
  record: PluginRecord,
  options: { collector?: SourceCollector; errors: string[] }
): Promise<void> {
  if (!record.installPath) {
    return;
  }
  const root = record.installPath;
  const manifests = await readManifest(record, options.errors);
  await addSkills(record, {
    manifest: manifests.components,
    collector: options.collector,
    errors: options.errors
  });
  if (record.tool === "claude") {
    await addPluginCommands(record, {
      manifest: manifests.components,
      collector: options.collector,
      errors: options.errors
    });
    await addAgents(record, {
      manifest: manifests.components,
      errors: options.errors
    });
  }
  const defaultHooks = join(root, "hooks", "hooks.json");
  if (
    (record.tool === "claude" || manifests.configured.hooks === undefined) &&
    (await fileExists(defaultHooks))
  ) {
    await addMap(record, {
      path: defaultHooks,
      kind: "hook",
      errors: options.errors
    });
  }
  for (const name of ["mcp.json", ".mcp.json"]) {
    const path = join(root, name);
    if (await fileExists(path)) {
      await addMap(record, { path, kind: "mcp", errors: options.errors });
    }
  }
  await addConfiguredMaps(record, {
    manifest: manifests.configured,
    sourcePath: manifests.configuredPath,
    errors: options.errors
  });
}
