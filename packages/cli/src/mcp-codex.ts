import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpRecord } from "@agent-mapper/core";
import { codexProjectConfigPaths } from "./codex-config-paths";
import { add, type Source } from "./mcp-record";
import type { JsonMap } from "./plugin-reader-common";

function tomlName(heading: string): string | undefined {
  const match = /^mcp_servers\.(?:([A-Za-z0-9_-]+)|"((?:\\.|[^"\\])*)")$/.exec(
    heading
  );
  if (!match) {
    return undefined;
  }
  if (match[1]) {
    return match[1];
  }
  try {
    return JSON.parse(`"${match[2] ?? ""}"`) as string;
  } catch {
    return undefined;
  }
}

function tomlString(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^"(?:\\.|[^"\\])*"$/.test(trimmed)) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return undefined;
    }
  }
  return /^'[^']*'$/.test(trimmed) ? trimmed.slice(1, -1) : undefined;
}

function parseTomlMcp(
  content: string,
  options: { records: McpRecord[]; source: Source }
): void {
  let current: { name: string; value: JsonMap } | undefined;
  const finish = () => {
    if (current) {
      add(options.records, {
        source: options.source,
        name: current.name,
        value: current.value,
        locator: `mcp_servers.${current.name}`
      });
    }
  };
  for (const line of content.split(/\r?\n/)) {
    const heading = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (/^\s*\[/.test(line)) {
      finish();
      const name = heading ? tomlName(heading[1] ?? "") : undefined;
      current = name ? { name, value: {} } : undefined;
      continue;
    }
    if (!current) {
      continue;
    }
    const pair =
      /^\s*(command|url|enabled|type)\s*=\s*("(?:\\.|[^"\\])*"|'[^']*'|true|false)\s*(?:#.*)?$/.exec(
        line
      );
    if (pair) {
      let value: string | boolean | undefined;
      if (pair[2] === "false") {
        value = false;
      } else if (pair[2] === "true") {
        value = true;
      } else {
        value = tomlString(pair[2] ?? "");
      }
      current.value[pair[1] ?? ""] = value;
    }
  }
  finish();
}

async function addToml(
  records: McpRecord[],
  options: { source: Source; errors: string[] }
): Promise<void> {
  let content: string;
  try {
    content = await readFile(options.source.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      options.errors.push(
        `${options.source.path}: Could not read MCP settings.`
      );
    }
    return;
  }
  parseTomlMcp(content, { records, source: options.source });
}

function markCollisions(records: McpRecord[]): void {
  const selected = new Map<string, McpRecord>();
  for (const record of records) {
    const previous = selected.get(record.name);
    if (previous && previous.availability !== "disabled") {
      previous.availability = "unknown";
      previous.reason = `A higher-priority Codex layer also declares this server: ${record.sourcePath}. Project trust and field merging are not verified.`;
    }
    selected.set(record.name, record);
  }
}

export async function addCodexMcp(
  records: McpRecord[],
  options: {
    root: string;
    workingDirectory: string;
    codexHome: string;
    errors: string[];
  }
): Promise<void> {
  const start = records.length;
  const userPath = join(options.codexHome, "config.toml");
  await addToml(records, {
    source: { path: userPath, tool: "codex", scope: "global" },
    errors: options.errors
  });
  for (const path of codexProjectConfigPaths(
    options.root,
    options.workingDirectory
  )) {
    if (path === userPath) {
      continue;
    }
    await addToml(records, {
      source: { path, tool: "codex", scope: "project" },
      errors: options.errors
    });
  }
  markCollisions(records.slice(start));
}
