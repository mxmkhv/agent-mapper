import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PluginRecord } from "@agent-mapper/core";

export type JsonMap = Record<string, unknown>;
export interface PluginSetting {
  enabled: boolean;
  path: string;
  project: boolean;
}
export interface CachedPlugin {
  key: string;
  name: string;
  marketplace: string;
  version: string;
  path: string;
}
export interface PluginReaderOptions {
  workingDirectory: string;
  home: string;
  claudeConfigDir: string;
  codexHome: string;
}

const idLength = 20;

export function object(value: unknown): JsonMap | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonMap)
    : undefined;
}

export function plugin(
  record: Omit<PluginRecord, "id" | "contributions">
): PluginRecord {
  const source = record.installPath ?? record.sourcePath;
  const id = createHash("sha256")
    .update(`${record.tool}:${record.key}:${source}`)
    .digest("hex")
    .slice(0, idLength);
  return { ...record, id, contributions: [] };
}

export async function json(
  path: string,
  errors: string[]
): Promise<JsonMap | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    const result = object(value);
    if (!result) {
      errors.push(`${path}: Expected a JSON object.`);
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(`${path}: Could not read valid JSON.`);
    }
    return undefined;
  }
}

async function directories(path: string, errors: string[]): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: Could not list plugin cache directory. Check permissions.`
      );
    }
    return [];
  }
}

export async function cache(
  root: string,
  errors: string[]
): Promise<CachedPlugin[]> {
  const result: CachedPlugin[] = [];
  for (const marketplace of await directories(root, errors)) {
    for (const name of await directories(join(root, marketplace), errors)) {
      for (const version of await directories(
        join(root, marketplace, name),
        errors
      )) {
        result.push({
          key: `${name}@${marketplace}`,
          name,
          marketplace,
          version,
          path: join(root, marketplace, name, version)
        });
      }
    }
  }
  return result;
}

export function splitKey(key: string): { name: string; marketplace?: string } {
  const at = key.lastIndexOf("@");
  return at < 0
    ? { name: key }
    : { name: key.slice(0, at), marketplace: key.slice(at + 1) };
}
