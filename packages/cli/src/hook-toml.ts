import type { HookRecord } from "@agent-mapper/core";
import type { CodexTomlReader } from "./codex-toml";
import { addGroups, type HookSource } from "./hook-record";
import { object } from "./plugin-reader-common";

export async function addToml(
  hooks: HookRecord[],
  options: { source: HookSource; toml: CodexTomlReader }
): Promise<void> {
  const data = await options.toml.read(options.source.path);
  addGroups(hooks, { source: options.source, events: object(data?.hooks) });
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
