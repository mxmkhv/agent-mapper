import { basename, extname } from "node:path";
import type { PluginRecord } from "@agent-mapper/core";
import { object, type JsonMap } from "./plugin-reader-common";
import {
  addContribution,
  markdownFiles,
  paths,
  safePath
} from "./plugin-contribution-utils";

export async function addAgents(
  record: PluginRecord,
  options: { manifest: JsonMap; errors: string[] }
): Promise<void> {
  const root = record.installPath;
  if (!root) {
    return;
  }
  const declared = options.manifest.agents;
  const locations = declared === undefined ? ["./agents"] : paths(declared);
  for (const relative of locations) {
    const path = await safePath(root, relative);
    if (!path) {
      continue;
    }
    const files =
      extname(path) === ".md"
        ? [path]
        : await markdownFiles(path, { errors: options.errors });
    for (const file of files) {
      addContribution(record.contributions, {
        kind: "agent",
        name:
          extname(path) === ".md"
            ? basename(file, ".md")
            : file.slice(path.length + 1).replace(/\.md$/, ""),
        sourcePath: file
      });
    }
  }
  const inline = object(declared);
  if (inline) {
    for (const [name, value] of Object.entries(inline)) {
      const source = object(value)?.source;
      const sourcePath =
        typeof source === "string" ? await safePath(root, source) : undefined;
      addContribution(record.contributions, {
        kind: "agent",
        name,
        sourcePath: sourcePath ?? record.sourcePath
      });
    }
  }
}
