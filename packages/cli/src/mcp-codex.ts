import { join } from "node:path";
import type { McpRecord } from "@agent-mapper/core";
import { codexProjectConfigPaths } from "./codex-config-paths";
import type { CodexTomlReader } from "./codex-toml";
import { add, type Source } from "./mcp-record";
import { object } from "./plugin-reader-common";

async function addToml(
  records: McpRecord[],
  options: { source: Source; toml: CodexTomlReader }
): Promise<void> {
  const data = await options.toml.read(options.source.path);
  for (const [name, value] of Object.entries(object(data?.mcp_servers) ?? {})) {
    add(records, {
      source: options.source,
      name,
      value,
      locator: `mcp_servers.${name}`
    });
  }
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
    toml: CodexTomlReader;
  }
): Promise<void> {
  const start = records.length;
  const userPath = join(options.codexHome, "config.toml");
  await addToml(records, {
    source: { path: userPath, tool: "codex", scope: "global" },
    toml: options.toml
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
      toml: options.toml
    });
  }
  markCollisions(records.slice(start));
}
