import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpRecord, PluginRecord } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import { add, type Source } from "./mcp-record";
import { addManagedMcp } from "./mcp-managed";
import type { ManagedSettingsFile } from "./managed-claude-reader";
import { json, object, type JsonMap } from "./plugin-reader-common";

function addMap(
  records: McpRecord[],
  options: {
    source: Source;
    data: JsonMap;
    prefix: string;
  }
): void {
  for (const [name, value] of Object.entries(
    object(options.data.mcpServers) ?? {}
  )) {
    add(records, {
      source: options.source,
      name,
      value,
      locator: `${options.prefix}.${name}`
    });
  }
}

async function addJson(
  records: McpRecord[],
  options: {
    source: Source;
    errors: string[];
    project?: string;
  }
): Promise<void> {
  const data = await json(options.source.path, options.errors);
  if (!data) {
    return;
  }
  if (options.project) {
    const project = object(object(data.projects)?.[options.project]);
    if (project) {
      addMap(records, {
        source: { ...options.source, scope: "project" },
        data: project,
        prefix: `projects.${options.project}.mcpServers`
      });
    }
  } else {
    addMap(records, { source: options.source, data, prefix: "mcpServers" });
  }
}

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

async function addToml(
  records: McpRecord[],
  options: {
    source: Source;
    errors: string[];
  }
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
  let current: { name: string; value: JsonMap } | undefined;
  const finish = () => {
    if (current) {
      add(records, {
        source: options.source,
        name: current.name,
        value: current.value,
        locator: `mcp_servers.${current.name}`
      });
    }
  };
  for (const line of content.split(/\r?\n/)) {
    const heading = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (heading) {
      finish();
      const name = tomlName(heading[1] ?? "");
      current = name ? { name, value: {} } : undefined;
      continue;
    }
    if (!current) {
      continue;
    }
    const pair = /^\s*(command|url|enabled|type)\s*=\s*(.+?)\s*(?:#.*)?$/.exec(
      line
    );
    if (pair) {
      current.value[pair[1] ?? ""] =
        pair[2] === "false" ? false : tomlString(pair[2] ?? "");
    }
  }
  finish();
}

async function addPlugins(
  records: McpRecord[],
  options: {
    plugins: PluginRecord[];
    errors: string[];
  }
): Promise<void> {
  for (const plugin of options.plugins) {
    const contributions = plugin.contributions.filter(
      (item) => item.kind === "mcp"
    );
    const files = new Map<string, JsonMap>();
    for (const contribution of contributions) {
      let data = files.get(contribution.sourcePath);
      if (!data) {
        data = (await json(contribution.sourcePath, options.errors)) ?? {};
        files.set(contribution.sourcePath, data);
      }
      const extension = object(object(data.extensions)?.["com.openai"]);
      const values = [object(data.mcpServers), object(extension?.mcpServers)];
      const declaration = values.find(
        (value) => value?.[contribution.name] !== undefined
      );
      if (!declaration) {
        continue;
      }
      const source: Source = {
        path: contribution.sourcePath,
        tool: plugin.tool,
        scope: plugin.scope,
        plugin
      };
      add(records, {
        source,
        name: contribution.name,
        value: declaration[contribution.name],
        locator: `mcpServers.${contribution.name}`
      });
      contribution.entryId = records.at(-1)?.id;
    }
  }
}

function markClaudeShadowing(records: McpRecord[], projectPath: string): void {
  const privateRank = 3;
  const direct = records.filter(
    (record) => record.tool === "claude" && !record.pluginId
  );
  const rank = (record: McpRecord) => {
    if (record.sourcePath === projectPath) {
      return 2;
    }
    return record.scope === "project" ? privateRank : 1;
  };
  for (const record of direct) {
    const winner = direct.find(
      (candidate) =>
        candidate.name === record.name && rank(candidate) > rank(record)
    );
    if (winner) {
      record.availability = "shadowed";
      record.reason = `Higher-priority Claude declaration: ${winner.sourcePath}`;
    }
  }
}

async function projectRoot(workingDirectory: string): Promise<string> {
  return (await findGitRoot(workingDirectory, "/")) ?? workingDirectory;
}

export async function scanMcp(options: {
  workingDirectory: string;
  claudeStatePath: string;
  codexHome: string;
  plugins: PluginRecord[];
  managedClaudeDir: string;
  managedSettings: ManagedSettingsFile[];
}): Promise<{ mcpServers: McpRecord[]; errors: string[] }> {
  const mcpServers: McpRecord[] = [];
  const errors: string[] = [];
  const root = await projectRoot(options.workingDirectory);
  const claudePath = options.claudeStatePath;
  await addJson(mcpServers, {
    source: { path: claudePath, tool: "claude", scope: "global" },
    errors
  });
  await addJson(mcpServers, {
    source: { path: claudePath, tool: "claude", scope: "global" },
    errors,
    project: root
  });
  await addJson(mcpServers, {
    source: { path: join(root, ".mcp.json"), tool: "claude", scope: "project" },
    errors
  });
  await addToml(mcpServers, {
    source: {
      path: join(options.codexHome, "config.toml"),
      tool: "codex",
      scope: "global"
    },
    errors
  });
  await addToml(mcpServers, {
    source: {
      path: join(root, ".codex", "config.toml"),
      tool: "codex",
      scope: "project"
    },
    errors
  });
  await addPlugins(mcpServers, { plugins: options.plugins, errors });
  markClaudeShadowing(mcpServers, join(root, ".mcp.json"));
  await addManagedMcp(mcpServers, {
    directory: options.managedClaudeDir,
    settings: options.managedSettings,
    errors
  });
  return { mcpServers, errors };
}
