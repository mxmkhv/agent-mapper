import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  HookRecord,
  InventoryEntry,
  McpRecord,
  MemoryRecord,
  PluginRecord
} from "@agent-mapper/core";
import { SourceCollector } from "./source-reader";
import { findGitRoot } from "./discovery";
import { scanPlugins } from "./plugin-reader";
import { scanHooks } from "./hook-reader";
import { scanMcp } from "./mcp-reader";
import { scanMemory } from "./memory-reader";
export { discoverProjects, type DiscoveryResult } from "./discovery";

export interface ScanOptions {
  workingDirectory: string;
  home?: string;
  codexHome?: string;
}
export interface ScanResult {
  entries: InventoryEntry[];
  plugins: PluginRecord[];
  hooks: HookRecord[];
  mcpServers: McpRecord[];
  memories: MemoryRecord[];
  errors: string[];
  roots: { claude: string; codex: string };
}

function scanErrors(groups: readonly { errors: string[] }[]): string[] {
  return [...new Set(groups.flatMap((group) => group.errors))];
}

async function scanRelated(options: {
  workingDirectory: string;
  home: string;
  codexHome: string;
  plugins: PluginRecord[];
}) {
  const hooks = await scanHooks(options);
  const mcp = await scanMcp(options);
  return { hooks, mcp };
}

function ancestors(path: string): string[] {
  const result: string[] = [];
  let current = resolve(path);
  for (;;) {
    result.unshift(current);
    const parent = dirname(current);
    if (parent === current) {
      return result;
    }
    current = parent;
  }
}

async function scanDirectory(
  collector: SourceCollector,
  options: { directory: string; includeCodex: boolean }
): Promise<void> {
  const { directory, includeCodex } = options;
  const instructionPaths = [
    ["claude", "CLAUDE.md"],
    ["claude", "CLAUDE.local.md"],
    ["claude", ".claude/CLAUDE.md"],
    ["claude", "AGENTS.md"],
    ["claude", ".claude/AGENTS.md"],
    ["codex", "AGENTS.md"],
    ["codex", "AGENTS.override.md"]
  ] as const;
  for (const [tool, name] of instructionPaths) {
    if (tool === "codex" && !includeCodex) {
      continue;
    }
    await collector.add({
      tool,
      kind: "instruction",
      path: join(directory, name),
      scope: "project"
    });
  }
  const skillPaths = [
    ["claude", ".claude/skills"],
    ["codex", ".agents/skills"],
    ["codex", ".codex/skills"]
  ] as const;
  for (const [tool, name] of skillPaths) {
    if (tool === "codex" && !includeCodex) {
      continue;
    }
    await collector.addSkills({
      tool,
      directory: join(directory, name),
      scope: "project",
      projectPath: directory
    });
  }
}

interface GlobalRoots {
  home: string;
  claude: string;
  codex: string;
}

async function scanGlobal(
  collector: SourceCollector,
  roots: GlobalRoots
): Promise<void> {
  await collector.add({
    tool: "claude",
    kind: "instruction",
    path: join(roots.claude, "CLAUDE.md"),
    scope: "global"
  });
  await collector.add({
    tool: "codex",
    kind: "instruction",
    path: join(roots.codex, "AGENTS.md"),
    scope: "global"
  });
  await collector.add({
    tool: "codex",
    kind: "instruction",
    path: join(roots.codex, "AGENTS.override.md"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "claude",
    directory: join(roots.claude, "skills"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "codex",
    directory: join(roots.codex, "skills"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "codex",
    directory: join(roots.home, ".agents", "skills"),
    scope: "global"
  });
}

export async function scanInventory(options: ScanOptions): Promise<ScanResult> {
  const home = resolve(options.home ?? homedir());
  const roots = {
    claude: join(home, ".claude"),
    codex: resolve(
      options.codexHome ?? process.env.CODEX_HOME ?? join(home, ".codex")
    )
  };
  const collector = new SourceCollector();
  await scanGlobal(collector, { home, ...roots });
  const workingDirectory = resolve(options.workingDirectory);
  const gitRoot = await findGitRoot(workingDirectory, "/");
  for (const directory of ancestors(workingDirectory)) {
    await scanDirectory(collector, {
      directory,
      includeCodex: gitRoot
        ? directory === gitRoot || directory.startsWith(`${gitRoot}/`)
        : directory === workingDirectory
    });
  }
  const plugins = await scanPlugins({
    workingDirectory,
    home,
    codexHome: roots.codex,
    collector
  });
  const { hooks, mcp } = await scanRelated({
    workingDirectory,
    home,
    codexHome: roots.codex,
    plugins: plugins.plugins
  });
  const memory = await scanMemory({
    workingDirectory,
    home,
    codexHome: roots.codex
  });
  return {
    entries: collector.entries,
    plugins: plugins.plugins,
    hooks: hooks.hooks,
    mcpServers: mcp.mcpServers,
    memories: memory.memories,
    errors: scanErrors([collector, plugins, hooks, mcp, memory]),
    roots
  };
}
