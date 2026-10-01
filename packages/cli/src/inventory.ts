import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  HookRecord,
  AgentRecord,
  InventoryEntry,
  McpRecord,
  MemoryRecord,
  PluginRecord
} from "@agent-mapper/core";
import { SourceCollector } from "./source-reader";
import { scanPlugins } from "./plugin-reader";
import { scanHooks } from "./hook-reader";
import { scanMcp } from "./mcp-reader";
import { scanMemory } from "./memory-reader";
import { scanAgents } from "./agent-reader";
import {
  managedClaudeDirectory,
  scanManagedClaude,
  type ManagedSettingsFile
} from "./managed-claude-reader";
import { resolveScanContext, type ScanContext } from "./scan-context";
import { scanGlobal, scanProjectSources } from "./instruction-sources";
import { CodexTomlReader } from "./codex-toml";
export { discoverProjects } from "./discovery";

export interface ScanOptions {
  workingDirectory: string;
  home?: string;
  codexHome?: string;
  claudeConfigDir?: string;
  managedClaudeDir?: string;
}
export interface ScanResult {
  entries: InventoryEntry[];
  plugins: PluginRecord[];
  hooks: HookRecord[];
  mcpServers: McpRecord[];
  memories: MemoryRecord[];
  agents: AgentRecord[];
  errors: string[];
  roots: { claude: string; codex: string };
  contentFor(path: string): string | undefined;
}

function scanErrors(groups: readonly { errors: string[] }[]): string[] {
  return [...new Set(groups.flatMap((group) => group.errors))];
}

async function scanRelated(options: {
  root: string;
  worktrees: ScanContext["worktrees"];
  workingDirectory: string;
  home: string;
  codexHome: string;
  claudeConfigDir: string;
  claudeStatePath: string;
  plugins: PluginRecord[];
  entries: InventoryEntry[];
  agents: AgentRecord[];
  managedSettings: ManagedSettingsFile[];
  managedClaudeDir: string;
  contentFor(path: string): string | undefined;
  toml: CodexTomlReader;
}) {
  const { toml } = options;
  const [hooks, mcp, memory] = await Promise.all([
    scanHooks({ ...options, toml }),
    scanMcp({ ...options, toml }),
    scanMemory(options)
  ]);
  return { hooks, mcp, memory };
}

export function configRoots(options: ScanOptions, home: string) {
  const customClaude = options.claudeConfigDir ?? process.env.CLAUDE_CONFIG_DIR;
  const roots = {
    claude: resolve(
      options.workingDirectory,
      customClaude || join(home, ".claude")
    ),
    codex: resolve(
      options.codexHome ?? process.env.CODEX_HOME ?? join(home, ".codex")
    )
  };
  const claudeStatePath = customClaude
    ? join(roots.claude, ".claude.json")
    : join(home, ".claude.json");
  return { roots, claudeStatePath };
}

async function scanBase(options: {
  workingDirectory: string;
  home: string;
  root: string;
  roots: ReturnType<typeof configRoots>["roots"];
  managedClaudeDir: string;
  toml: CodexTomlReader;
}) {
  const collector = new SourceCollector();
  const managedSettings = await scanManagedClaude(
    collector,
    options.managedClaudeDir
  );
  await scanGlobal(collector, { home: options.home, ...options.roots });
  await scanProjectSources(collector, {
    workingDirectory: options.workingDirectory,
    root: options.root,
    home: options.home
  });
  const plugins = await scanPlugins({
    workingDirectory: options.workingDirectory,
    root: options.root,
    home: options.home,
    claudeConfigDir: options.roots.claude,
    codexHome: options.roots.codex,
    collector,
    toml: options.toml
  });
  const agents = await scanAgents({
    workingDirectory: options.workingDirectory,
    root: options.root,
    home: options.home,
    claudeConfigDir: options.roots.claude,
    codexHome: options.roots.codex,
    plugins: plugins.plugins
  });
  return { collector, managedSettings, plugins, agents };
}

export async function scanInventory(
  options: ScanOptions,
  resolvedContext?: ScanContext
): Promise<ScanResult> {
  const home = resolve(options.home ?? homedir());
  const workingDirectory = resolve(options.workingDirectory);
  const context =
    resolvedContext ?? (await resolveScanContext(workingDirectory));
  const { roots, claudeStatePath } = configRoots(options, home);
  const managedClaudeDir = managedClaudeDirectory(options);
  const toml = new CodexTomlReader();
  const { collector, managedSettings, plugins, agents } = await scanBase({
    workingDirectory,
    root: context.root,
    home,
    roots,
    managedClaudeDir,
    toml
  });
  const { hooks, mcp, memory } = await scanRelated({
    workingDirectory,
    root: context.root,
    worktrees: context.worktrees,
    home,
    claudeConfigDir: roots.claude,
    claudeStatePath,
    codexHome: roots.codex,
    plugins: plugins.plugins,
    entries: collector.entries,
    agents: agents.agents,
    managedSettings,
    managedClaudeDir,
    contentFor: (path) => collector.content(path),
    toml
  });
  return {
    entries: collector.entries,
    plugins: plugins.plugins,
    hooks: hooks.hooks,
    mcpServers: mcp.mcpServers,
    memories: memory.memories,
    agents: agents.agents,
    errors: scanErrors([collector, plugins, hooks, mcp, memory, agents, toml]),
    roots,
    contentFor: (path) => collector.content(path)
  };
}
