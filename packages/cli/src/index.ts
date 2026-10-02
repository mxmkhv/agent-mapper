#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { supportedTools, type ToolId } from "@agent-mapper/core";
import packageJson from "../package.json" with { type: "json" };
import { createDesktop } from "./desktop";
import { createAppServer } from "./service";

const usage = `agent-mapper

Local configuration inventory for ${supportedTools.join(" and ")}.

Usage:
  agent-mapper [--tools claude,codex]
  agent-mapper --help
  agent-mapper --version`;

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

async function launchUi(tools: ToolId[]): Promise<void> {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "web");
  const desktop = createDesktop({
    platform: process.platform,
    env: process.env
  });
  const app = createAppServer({ webRoot, desktop });
  const address = await app.listen();
  const filter = tools.length === 1 ? `?tools=${tools[0]}` : "";
  const url = `http://127.0.0.1:${address.port}/${filter}#${app.token}`;
  console.log(`Open agent-mapper: ${url}`);
  // Without a desktop session (SSH, containers, WSL) this fails fast and the printed URL is the way in.
  void desktop({ action: "browse", url }).catch((error: unknown) =>
    console.error(
      `Could not open the browser. ${error instanceof Error ? error.message : String(error)} Open the URL above in a browser.`
    )
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      tools: { type: "string" },
      version: { type: "boolean", short: "v" }
    }
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (values.version) {
    console.log(packageJson.version);
    return;
  }
  if (positionals.length > 0) {
    throw new Error(
      `Unknown command "${positionals[0]}". Run --help for usage.`
    );
  }
  await launchUi(selectedTools(values.tools));
}

main().catch((error: unknown) => {
  console.error(
    `agent-mapper: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
