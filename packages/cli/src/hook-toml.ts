import type { HookRecord } from "@agent-mapper/core";
import { join } from "node:path";
import { codexProjectConfigPaths } from "./codex-config-paths";
import type { CodexTomlReader } from "./codex-toml";
import { addGroups, type HookSource } from "./hook-record";
import { object } from "./plugin-reader-common";

async function addToml(
  hooks: HookRecord[],
  options: { source: HookSource; toml: CodexTomlReader; errors: string[] }
): Promise<void> {
  const data = await options.toml.read(options.source.path);
  if (data?.hooks !== undefined && !object(data.hooks)) {
    options.errors.push(
      `${options.source.path}: hooks must be a table of events; it was skipped.`
    );
    return;
  }
  addGroups(hooks, {
    source: options.source,
    events: object(data?.hooks),
    errors: options.errors
  });
}

export async function codexHooksSetting(
  path: string,
  toml: CodexTomlReader
): Promise<boolean | undefined> {
  const data = await toml.read(path);
  const features = object(data?.features);
  let setting: boolean | undefined;
  for (const [key, value] of Object.entries(features ?? {})) {
    if (
      (key === "hooks" || key === "codex_hooks") &&
      typeof value === "boolean"
    ) {
      setting = value;
    }
  }
  return setting;
}

/** Hooks declared inline in the user and project `config.toml` files, each file read once. */
export async function addCodexTomlHooks(
  hooks: HookRecord[],
  options: {
    root: string;
    workingDirectory: string;
    codexHome: string;
    seen: Set<string>;
    toml: CodexTomlReader;
    errors: string[];
  }
): Promise<void> {
  const paths = [
    { path: join(options.codexHome, "config.toml"), scope: "global" as const },
    ...codexProjectConfigPaths(options.root, options.workingDirectory).map(
      (path) => ({ path, scope: "project" as const })
    )
  ];
  for (const source of paths) {
    if (options.seen.has(source.path)) {
      continue;
    }
    options.seen.add(source.path);
    await addToml(hooks, {
      source: { ...source, tool: "codex" },
      toml: options.toml,
      errors: options.errors
    });
  }
}
