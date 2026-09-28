#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  supportedTools,
  type InventorySnapshot,
  type ToolId
} from "@agent-mapper/core";
import { buildSnapshot, createAppServer } from "./service";

const usage = `agent-mapper

Local configuration inventory for ${supportedTools.join(" and ")}.

Usage:
  agent-mapper [--tools claude,codex]
  agent-mapper why [folder] [--tools claude,codex]
  agent-mapper --json [folder] [--tools claude,codex]
  agent-mapper --help`;

function selectedTools(value: string | undefined): ToolId[] {
  if (!value) {
    return ["claude", "codex"];
  }
  const names = value.split(",");
  if (
    names.length === 0 ||
    names.some((name) => name !== "claude" && name !== "codex")
  ) {
    throw new Error("--tools accepts claude,codex, claude, or codex.");
  }
  return [...new Set(names)] as ToolId[];
}

interface ExplanationOptions {
  folder: string;
  tools: ToolId[];
  json: boolean;
}

function printMcp(
  servers: Awaited<ReturnType<typeof buildSnapshot>>["mcpServers"]
): void {
  for (const server of servers) {
    console.log(`${server.tool} MCP ${server.name}: ${server.availability}`);
    console.log(`  ${server.sourcePath}#${server.locator}`);
    console.log(`  ${server.transport} · ${server.destination}`);
  }
}

function printMemory(
  memories: Awaited<ReturnType<typeof buildSnapshot>>["memories"]
): void {
  for (const memory of memories) {
    console.log(
      `${memory.tool} memory ${memory.name}: ${memory.readState}, ${memory.projectMatch}`
    );
    console.log(`  ${memory.sourcePath}`);
  }
}

function printAgents(
  agents: Awaited<ReturnType<typeof buildSnapshot>>["agents"]
): void {
  for (const agent of agents) {
    console.log(`${agent.tool} agent ${agent.name}: ${agent.availability}`);
    console.log(`  ${agent.sourcePath}#${agent.locator}`);
    console.log(`  ${agent.reason}`);
  }
}

function printHooks(
  hooks: Awaited<ReturnType<typeof buildSnapshot>>["hooks"]
): void {
  for (const hook of hooks) {
    console.log(`${hook.tool} hook ${hook.event}: ${hook.availability}`);
    console.log(`  ${hook.sourcePath}#${hook.locator}`);
    console.log(`  ${hook.reason}`);
  }
}

function printPlugins(
  plugins: Awaited<ReturnType<typeof buildSnapshot>>["plugins"]
): void {
  for (const plugin of plugins) {
    console.log(`${plugin.tool} plugin ${plugin.key}: ${plugin.state}`);
    console.log(`  ${plugin.sourcePath}`);
    console.log(`  ${plugin.reason}`);
  }
}

function printEntries(
  items: Awaited<ReturnType<typeof buildSnapshot>>["items"]
): void {
  for (const { entry, resolution } of items) {
    console.log(
      `${entry.tool} ${entry.kind} ${entry.name}: ${resolution.availability}, ${resolution.loading}`
    );
    console.log(`  ${entry.path}`);
    console.log(`  ${resolution.reason}`);
  }
}

function filterSnapshot(snapshot: InventorySnapshot, tools: ToolId[]) {
  const items = snapshot.items.filter(({ entry }) =>
    tools.includes(entry.tool)
  );
  const plugins = snapshot.plugins.filter((plugin) =>
    tools.includes(plugin.tool)
  );
  const hooks = snapshot.hooks.filter((hook) => tools.includes(hook.tool));
  const mcpServers = snapshot.mcpServers.filter((server) =>
    tools.includes(server.tool)
  );
  const agents = snapshot.agents.filter((agent) => tools.includes(agent.tool));
  const comparison = snapshot.comparison && {
    ...snapshot.comparison,
    differences: snapshot.comparison.differences.filter(
      (row) => row.tool === "shared" || tools.includes(row.tool)
    )
  };
  const memories = snapshot.memories.filter((memory) =>
    memory.tool === "unknown" ? tools.length > 1 : tools.includes(memory.tool)
  );
  const context = Object.fromEntries(
    tools.map((tool) => [tool, snapshot.context[tool]])
  );
  const findings = snapshot.findings.filter((finding) =>
    tools.includes(finding.tool)
  );
  return {
    items,
    plugins,
    hooks,
    mcpServers,
    agents,
    comparison,
    memories,
    context,
    findings
  };
}

async function explain(options: ExplanationOptions): Promise<void> {
  const snapshot = await buildSnapshot(options.folder);
  const filtered = filterSnapshot(snapshot, options.tools);
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...snapshot,
          ...filtered
        },
        null,
        2
      )
    );
    return;
  }
  console.log(`Fresh local CLI model for ${snapshot.workingDirectory}`);
  console.log(
    `Configuration roots: Claude ${snapshot.roots.claude}; Codex ${snapshot.roots.codex}`
  );
  printEntries(filtered.items);
  printPlugins(filtered.plugins);
  printHooks(filtered.hooks);
  printMcp(filtered.mcpServers);
  printMemory(filtered.memories);
  printAgents(filtered.agents);
  for (const finding of filtered.findings) {
    console.log(
      `${finding.tool} ${finding.level} ${finding.title}: ${finding.reason}`
    );
    for (const source of finding.sources) {
      console.log(`  ${source.path}`);
    }
  }
  for (const note of snapshot.coverage) {
    console.log(`Coverage: ${note}`);
  }
}

async function launchUi(tools: ToolId[]): Promise<void> {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "web");
  const app = createAppServer({ webRoot });
  const address = await app.listen();
  const filter = tools.length === 1 ? `?tools=${tools[0]}` : "";
  const url = `http://127.0.0.1:${address.port}/${filter}#${app.token}`;
  console.log(`Open agent-mapper: ${url}`);
  if (process.platform === "darwin") {
    const child = spawn("open", [url], { stdio: "ignore" });
    child.on("error", (error) =>
      console.error(
        `Could not open the browser: ${error.message}. Open the URL above manually.`
      )
    );
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      json: { type: "boolean" },
      tools: { type: "string" }
    }
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const tools = selectedTools(values.tools);
  const command = positionals[0];
  if (command && command !== "why" && !values.json) {
    throw new Error(`Unknown command ${command}. Run --help for usage.`);
  }
  if (command === "why" || values.json) {
    const folder = resolve(positionals[command === "why" ? 1 : 0] ?? ".");
    await explain({ folder, tools, json: values.json ?? false });
    return;
  }
  await launchUi(tools);
}

main().catch((error: unknown) => {
  console.error(
    `agent-mapper: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
