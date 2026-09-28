import { readFile } from "node:fs/promises";
import type { HookRecord } from "@agent-mapper/core";
import { append, type HookSource } from "./hook-record";
import type { JsonMap } from "./plugin-reader-common";

function tomlString(raw: string): string | undefined {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return undefined;
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return undefined;
}

interface TomlState {
  event?: string;
  groupIndex: number;
  handlerIndex: number;
  matcher?: string;
  handler?: JsonMap;
  groups: Map<string, number>;
}

function finish(
  hooks: HookRecord[],
  options: { source: HookSource; state: TomlState }
): void {
  const { source, state } = options;
  if (
    state.event &&
    state.handler &&
    state.groupIndex >= 0 &&
    state.handlerIndex >= 0
  ) {
    append(hooks, {
      source,
      event: state.event,
      group: { matcher: state.matcher },
      groupIndex: state.groupIndex,
      handler: state.handler,
      handlerIndex: state.handlerIndex
    });
  }
  state.handler = undefined;
}

function setHeading(
  state: TomlState,
  options: { event: string; handlerSection: boolean }
): void {
  const { event, handlerSection } = options;
  if (handlerSection) {
    if (state.event !== event) {
      state.event = event;
      state.groupIndex = state.groups.get(event) ?? 0;
      state.handlerIndex = -1;
    }
    state.handlerIndex += 1;
    state.handler = {};
  } else {
    state.event = event;
    state.groupIndex = (state.groups.get(event) ?? -1) + 1;
    state.groups.set(event, state.groupIndex);
    state.handlerIndex = -1;
    state.matcher = undefined;
  }
}

function setField(
  state: TomlState,
  options: { key: string; value: string }
): void {
  const { key, value } = options;
  if (state.handler) {
    if (key === "type") {
      state.handler.type = tomlString(value);
    }
    if (key === "async") {
      state.handler.async = value === "true";
    }
    if (key === "timeout" && /^\d+$/.test(value)) {
      state.handler.timeout = Number(value);
    }
  } else if (key === "matcher") {
    state.matcher = tomlString(value);
  }
}

function parseToml(
  hooks: HookRecord[],
  options: { source: HookSource; content: string }
): void {
  const state: TomlState = {
    groupIndex: -1,
    handlerIndex: -1,
    groups: new Map()
  };
  for (const line of options.content.split(/\r?\n/)) {
    const section =
      /^\s*\[\[hooks\.([A-Za-z][A-Za-z0-9]*)(\.hooks)?\]\]\s*(?:#.*)?$/.exec(
        line
      );
    if (section) {
      finish(hooks, { source: options.source, state });
      setHeading(state, {
        event: section[1] ?? "",
        handlerSection: Boolean(section[2])
      });
      continue;
    }
    if (/^\s*\[/.test(line)) {
      finish(hooks, { source: options.source, state });
      state.event = undefined;
      continue;
    }
    if (!state.event) {
      continue;
    }
    const pair =
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:\\.|[^"\\])*"|'[^']*'|true|false|\d+)\s*(?:#.*)?$/.exec(
        line
      );
    if (pair) {
      setField(state, { key: pair[1] ?? "", value: pair[2] ?? "" });
    }
  }
  finish(hooks, { source: options.source, state });
}

export async function addToml(
  hooks: HookRecord[],
  options: { source: HookSource; errors: string[] }
): Promise<void> {
  let content: string;
  try {
    content = await readFile(options.source.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      options.errors.push(
        `${options.source.path}: Could not read hook settings.`
      );
    }
    return;
  }
  parseToml(hooks, { source: options.source, content });
}

export async function codexHooksSetting(
  path: string,
  errors: string[]
): Promise<boolean | undefined> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`${path}: Could not read Codex hook feature setting.`);
    }
    return undefined;
  }
  let inFeatures = false;
  let setting: boolean | undefined;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) {
      inFeatures = /^\s*\[features\]\s*(?:#.*)?$/.test(line);
    } else if (inFeatures) {
      const match =
        /^\s*(?:hooks|codex_hooks)\s*=\s*(true|false)\s*(?:#.*)?$/.exec(line);
      if (match) {
        setting = match[1] === "true";
      }
    }
  }
  return setting;
}
