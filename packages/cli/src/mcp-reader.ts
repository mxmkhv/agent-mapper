import { join } from "node:path";
import type { McpRecord, PluginRecord } from "@agent-mapper/core";
import { findGitRoot } from "./discovery";
import { add, type Source } from "./mcp-record";
import { addManagedMcp } from "./mcp-managed";
import { addCodexMcp } from "./mcp-codex";
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
  await addCodexMcp(mcpServers, {
    root,
    workingDirectory: options.workingDirectory,
    codexHome: options.codexHome,
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
