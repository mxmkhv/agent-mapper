import { stat } from "node:fs/promises";
import type { PluginRecord } from "@agent-mapper/core";
import { readClaudePlugins } from "./plugin-claude-reader";
import { readCodexPlugins } from "./plugin-codex-reader";
import { inspectPlugin } from "./plugin-contributions";
import type { PluginReaderOptions } from "./plugin-reader-common";
import { SourceCollector } from "./source-reader";

interface ReaderOptions extends PluginReaderOptions {
  collector: SourceCollector;
}
export interface PluginScan {
  plugins: PluginRecord[];
  errors: string[];
}

async function inspect(
  record: PluginRecord,
  options: { collector: SourceCollector; errors: string[] }
): Promise<void> {
  if (record.installPath) {
    try {
      if (!(await stat(record.installPath)).isDirectory()) {
        record.state = "missing";
        record.reason = "Installation path is not a folder.";
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        record.state = "missing";
        record.reason = "Installation path is missing.";
      } else {
        record.state = "unknown";
        record.reason = "Installation path could not be inspected.";
        options.errors.push(
          `${record.installPath}: Could not inspect plugin installation. Check permissions.`
        );
      }
    }
  }
  if (record.state !== "missing") {
    const before = options.errors.length;
    await inspectPlugin(record, options);
    if (options.errors.length > before) {
      record.issues = options.errors.slice(before);
    }
  }
}

export async function scanPlugins(options: ReaderOptions): Promise<PluginScan> {
  const errors: string[] = [];
  const plugins = [
    ...(await readClaudePlugins(options, errors)),
    ...(await readCodexPlugins(options, errors))
  ];
  for (const record of plugins) {
    await inspect(record, { collector: options.collector, errors });
  }
  return { plugins, errors };
}
