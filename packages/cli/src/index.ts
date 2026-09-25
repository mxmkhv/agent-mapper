#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { supportedTools, type ToolId } from "@agent-mapper/core";
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

async function explain(options: ExplanationOptions): Promise<void> {
  const snapshot = await buildSnapshot(options.folder);
  const items = snapshot.items.filter(({ entry }) =>
    options.tools.includes(entry.tool)
  );
  if (options.json) {
    console.log(JSON.stringify({ ...snapshot, items }, null, 2));
    return;
  }
  console.log(`Fresh local CLI model for ${snapshot.workingDirectory}`);
  console.log(
    `Configuration roots: Claude ${snapshot.roots.claude}; Codex ${snapshot.roots.codex}`
  );
  for (const { entry, resolution } of items) {
    console.log(
      `${entry.tool} ${entry.kind} ${entry.name}: ${resolution.availability}, ${resolution.loading}`
    );
    console.log(`  ${entry.path}`);
    console.log(`  ${resolution.reason}`);
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
