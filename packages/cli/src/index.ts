#!/usr/bin/env node
import { parseArgs } from "node:util";
import { supportedTools } from "@agent-mapper/core";

function main(): void {
  const { values } = parseArgs({
    options: { help: { type: "boolean", short: "h" } }
  });
  if (values.help) {
    console.log(
      `agent-mapper\n\nLocal configuration inventory for ${supportedTools.join(" and ")}.\n\nUsage: agent-mapper --help\n\nThe workspace is bootstrapped. Discovery and the local server are not implemented yet.`
    );
    return;
  }
  console.log(
    "Workspace ready. Run bun run dev from the repository to open the UI scaffold."
  );
}

try {
  main();
} catch (error) {
  console.error(
    `agent-mapper: ${error instanceof Error ? error.message : String(error)} Run agent-mapper --help for supported options.`
  );
  process.exitCode = 1;
}
