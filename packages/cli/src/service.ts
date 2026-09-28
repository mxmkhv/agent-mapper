import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  resolveInventory,
  summarizeContext,
  type InventoryEntry,
  type InventorySnapshot
} from "@agent-mapper/core";
import { scanInventory, type ScanOptions, type ScanResult } from "./inventory";
import { scanWorktrees } from "./worktree-compare";
import { buildFindings } from "./findings";
import { scanInstructionImports } from "./instruction-imports";
export { createAppServer } from "./server";

function coverage(errors: string[]): string[] {
  return [
    ...errors,
    "Hook coverage includes local managed files and skill and agent frontmatter. Agent Stop hooks become SubagentStop while running as subagents. Remote and device policy selection, activation, project trust, and unsupported TOML forms are not verified.",
    "MCP coverage excludes account and session connections, managed sources, approval state, and unsupported TOML forms. Servers are not contacted.",
    "Memory coverage includes local Markdown files only. Claude encoded folder names are candidates, not verified project matches; custom memory locations and live use are not resolved.",
    "Agent coverage includes local Claude Markdown and Codex TOML files, plus Claude plugin agent files. Managed and session agents, unsupported declarations, project trust, and live use are not verified. Agent prompts stay in source files.",
    "Worktree comparison checks common local configuration files by relative path and content. Generated folders and inherited global files are excluded. A changed settings file does not identify which declaration changed inside it.",
    "Context figures approximate known file text at four characters per token. Imported instruction content, skill listing budgets, memory loading, settings effects, and other runtime content are not estimated.",
    "Instruction resolution models default Claude Code and Codex file rules. Custom instruction file settings, trust decisions, and runtime overrides are not inspected.",
    "Claude user configuration follows CLAUDE_CONFIG_DIR in this process. An existing Claude session may use a different environment.",
    "Local managed Claude instructions are scanned when readable. Remote, MDM, registry, and host policy are not inspected; they may replace or combine with local managed settings.",
    "This view models a fresh local CLI session. Runtime flags, account-managed settings, and live session state are not inspected."
  ];
}

function resolveItems(entries: InventoryEntry[], path: string) {
  return [
    ...resolveInventory(entries, { workingDirectory: path, tool: "claude" }),
    ...resolveInventory(entries, { workingDirectory: path, tool: "codex" })
  ];
}

async function analyzeSources(options: {
  scan: ScanResult;
  path: string;
  home: string;
}) {
  const { scan, path, home } = options;
  const items = resolveItems(scan.entries, path);
  const imports = await scanInstructionImports({
    items,
    home,
    workingDirectory: path
  });
  const findings = await buildFindings({
    items,
    plugins: scan.plugins,
    imports: imports.imports
  });
  return { items, imports, findings };
}

async function validatedDirectory(workingDirectory: string): Promise<string> {
  const requestedPath = resolve(workingDirectory);
  let path: string;
  try {
    path = await realpath(requestedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${requestedPath} does not exist. Choose an existing folder.`
      );
    }
    throw error;
  }
  if (!(await stat(path)).isDirectory()) {
    throw new Error(`${path} is not a folder. Choose an existing folder.`);
  }
  return path;
}

export async function buildSnapshot(
  workingDirectory: string,
  options: Omit<ScanOptions, "workingDirectory"> = {}
): Promise<InventorySnapshot> {
  const path = await validatedDirectory(workingDirectory);
  const scan = await scanInventory({ ...options, workingDirectory: path });
  const worktree = await scanWorktrees(path);
  const { items, imports, findings } = await analyzeSources({
    scan,
    path,
    home: resolve(options.home ?? homedir())
  });
  return {
    workingDirectory: path,
    scannedAt: new Date().toISOString(),
    roots: scan.roots,
    plugins: scan.plugins,
    hooks: scan.hooks,
    mcpServers: scan.mcpServers,
    memories: scan.memories,
    agents: scan.agents,
    context: summarizeContext({
      items,
      agents: scan.agents,
      memories: scan.memories
    }),
    worktrees: worktree.worktrees,
    comparison: worktree.comparison,
    items,
    imports: imports.imports,
    findings: findings.findings,
    coverage: coverage([
      ...scan.errors,
      ...worktree.errors,
      ...imports.errors,
      ...findings.errors
    ])
  };
}

export async function buildGlobalSnapshot(
  options: Omit<ScanOptions, "workingDirectory"> = {}
): Promise<InventorySnapshot> {
  const snapshot = await buildSnapshot(options.home ?? homedir(), options);
  const items = snapshot.items.filter(
    ({ entry }) => entry.scope === "global" || entry.scope === "managed"
  );
  const agents = snapshot.agents.filter((agent) => agent.scope !== "project");
  const memories = snapshot.memories.filter(
    (memory) => memory.scope !== "project"
  );
  const plugins = snapshot.plugins.filter(
    (plugin) => plugin.scope !== "project"
  );
  const imports = snapshot.imports.filter((item) =>
    items.some(({ entry }) => entry.id === item.sourceEntryId)
  );
  const findings = await buildFindings({ items, plugins, imports });
  return {
    ...snapshot,
    items,
    imports,
    plugins,
    hooks: snapshot.hooks.filter((hook) => hook.scope !== "project"),
    mcpServers: snapshot.mcpServers.filter(
      (server) => server.scope !== "project"
    ),
    memories,
    agents,
    context: summarizeContext({ items, agents, memories }),
    findings: findings.findings,
    worktrees: [],
    comparison: undefined
  };
}
