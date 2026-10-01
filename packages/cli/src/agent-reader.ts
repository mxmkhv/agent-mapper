import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AgentRecord, PluginRecord } from "@agent-mapper/core";
import { inspectAgent, type AgentSource } from "./agent-record";

interface ScanOptions {
  workingDirectory: string;
  root: string;
  home: string;
  claudeConfigDir: string;
  codexHome: string;
  plugins: PluginRecord[];
}

async function children(path: string, errors: string[]) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: Could not list agent directory. Check permissions.`
      );
    }
    return [];
  }
}

async function append(
  agents: AgentRecord[],
  options: { source: AgentSource; errors: string[] }
): Promise<void> {
  const { source, errors } = options;
  try {
    const agent = await inspectAgent(source);
    if (agent) {
      agents.push(agent);
    }
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : `${source.path}: Could not inspect agent file.`
    );
  }
}

async function scanDirectory(
  agents: AgentRecord[],
  options: {
    directory: string;
    tool: AgentRecord["tool"];
    scope: AgentRecord["scope"];
    errors: string[];
  }
): Promise<void> {
  const extension = options.tool === "claude" ? ".md" : ".toml";
  for (const item of await children(options.directory, options.errors)) {
    const path = join(options.directory, item.name);
    if (item.isDirectory() && options.tool === "claude") {
      await scanDirectory(agents, { ...options, directory: path });
    } else if (
      item.name.endsWith(extension) &&
      (item.isFile() || item.isSymbolicLink())
    ) {
      await append(agents, {
        source: { path, tool: options.tool, scope: options.scope },
        errors: options.errors
      });
    }
  }
}

function projectDirectories(root: string, selected: string): string[] {
  const directories: string[] = [];
  let path = selected;
  while (path.startsWith(root)) {
    directories.unshift(path);
    if (path === root) {
      break;
    }
    path = dirname(path);
  }
  return directories;
}

async function scanProject(
  agents: AgentRecord[],
  input: { options: ScanOptions; errors: string[] }
): Promise<void> {
  const { options, errors } = input;
  for (const directory of projectDirectories(
    options.root,
    options.workingDirectory
  )) {
    if (resolve(directory) === resolve(options.home)) {
      continue;
    }
    await scanDirectory(agents, {
      directory: join(directory, ".claude", "agents"),
      tool: "claude",
      scope: "project",
      errors
    });
    await scanDirectory(agents, {
      directory: join(directory, ".codex", "agents"),
      tool: "codex",
      scope: "project",
      errors
    });
  }
}

async function scanPlugins(
  agents: AgentRecord[],
  options: { plugins: PluginRecord[]; errors: string[] }
): Promise<void> {
  for (const plugin of options.plugins) {
    for (const contribution of plugin.contributions) {
      if (
        contribution.kind !== "agent" ||
        !contribution.sourcePath.endsWith(".md")
      ) {
        continue;
      }
      const before = agents.length;
      await append(agents, {
        source: {
          path: contribution.sourcePath,
          tool: "claude",
          scope: plugin.scope,
          plugin,
          pluginName: `${plugin.name}:${contribution.name.replaceAll("/", ":")}`
        },
        errors: options.errors
      });
      if (agents.length > before) {
        contribution.entryId = agents.at(-1)?.id;
      }
    }
  }
}

function declarationRoot(agent: AgentRecord): string {
  return agent.sourcePath.split("/.claude/agents/")[0] ?? agent.sourcePath;
}

function markShadowed(agents: AgentRecord[]): void {
  const winners = new Map<string, AgentRecord>();
  const ambiguous = new Map<string, string>();
  for (const agent of agents) {
    if (agent.tool !== "claude" || agent.availability !== "configured") {
      continue;
    }
    const key = agent.name;
    const previous = winners.get(key);
    if (agent.pluginId) {
      continue;
    }
    const root = declarationRoot(agent);
    if (ambiguous.get(key) === root) {
      agent.availability = "unknown";
      agent.reason = `Multiple agents named ${agent.name} were found in this scope; selection is unclear.`;
      continue;
    }
    if (previous && declarationRoot(previous) === declarationRoot(agent)) {
      const reason = `Multiple agents named ${agent.name} were found in this scope; selection is unclear.`;
      previous.availability = "unknown";
      previous.reason = reason;
      agent.availability = "unknown";
      agent.reason = reason;
      // Something nearer still wins over the agents it shadowed, but which one is unclear, so none is named.
      for (const loser of agents) {
        if (loser.shadowedBy === previous.id) {
          loser.shadowedBy = undefined;
        }
      }
      ambiguous.set(key, root);
      winners.delete(key);
      continue;
    }
    ambiguous.delete(key);
    if (previous) {
      previous.availability = "shadowed";
      previous.reason = `A nearer ${agent.scope} agent named ${agent.name} takes precedence.`;
      previous.shadowedBy = agent.id;
    }
    winners.set(key, agent);
  }
}

export async function scanAgents(
  options: ScanOptions
): Promise<{ agents: AgentRecord[]; errors: string[] }> {
  const agents: AgentRecord[] = [];
  const errors: string[] = [];
  await scanDirectory(agents, {
    directory: join(options.claudeConfigDir, "agents"),
    tool: "claude",
    scope: "global",
    errors
  });
  await scanDirectory(agents, {
    directory: join(options.codexHome, "agents"),
    tool: "codex",
    scope: "global",
    errors
  });
  if (resolve(options.workingDirectory) !== resolve(options.home)) {
    await scanProject(agents, { options, errors });
  }
  await scanPlugins(agents, { plugins: options.plugins, errors });
  markShadowed(agents);
  return { agents, errors };
}
