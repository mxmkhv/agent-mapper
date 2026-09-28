import { basename, extname } from "node:path";
import type { PluginContribution, PluginRecord } from "@agent-mapper/core";
import { object, type JsonMap } from "./plugin-reader-common";
import {
  addContribution,
  fileExists,
  markdownFiles,
  paths,
  safePath
} from "./plugin-contribution-utils";
import { SourceCollector } from "./source-reader";

function commandName(record: PluginRecord, name: string): string {
  return name.startsWith(`${record.name}:`) ? name : `${record.name}:${name}`;
}

async function linkCommand(options: {
  record: PluginRecord;
  collector?: SourceCollector;
  contribution: PluginContribution;
  locator?: string;
  declarationOnly?: boolean;
}): Promise<void> {
  const { record, collector, contribution } = options;
  if (record.state !== "selected" || !collector) {
    return;
  }
  const name = commandName(record, contribution.name);
  let entry = collector.entries.find(
    (item) =>
      item.kind === "command" &&
      item.pluginId === record.id &&
      item.path === contribution.sourcePath &&
      item.name === name
  );
  if (!entry) {
    await collector.add({
      tool: record.tool,
      kind: "command",
      name,
      path: contribution.sourcePath,
      scope: record.scope,
      projectPath: record.projectPath,
      pluginId: record.id,
      locator: options.locator,
      declarationOnly: options.declarationOnly
    });
    entry = collector.entries.find(
      (item) =>
        item.pluginId === record.id &&
        item.path === contribution.sourcePath &&
        item.name === name
    );
  }
  contribution.entryId = entry?.id;
}

async function commandFiles(path: string, errors: string[]): Promise<string[]> {
  return extname(path) === ".md" ? [path] : markdownFiles(path, { errors });
}

async function addCommandFiles(
  record: PluginRecord,
  options: {
    locations: string[];
    collector?: SourceCollector;
    errors: string[];
  }
): Promise<void> {
  const root = record.installPath!;
  for (const relative of options.locations) {
    const path = await safePath(root, relative);
    if (!path) {
      continue;
    }
    const files = await commandFiles(path, options.errors);
    for (const file of files) {
      if (
        !(await fileExists(file)) ||
        !(await safePath(root, `./${file.slice(root.length + 1)}`))
      ) {
        continue;
      }
      const name =
        extname(path) === ".md"
          ? basename(file, ".md")
          : file
              .slice(path.length + 1)
              .replace(/\.md$/, "")
              .replaceAll("/", ":");
      addContribution(record.contributions, {
        kind: "command",
        name,
        sourcePath: file
      });
      const contribution = record.contributions.find(
        (item) =>
          item.kind === "command" &&
          item.name === name &&
          item.sourcePath === file
      );
      if (contribution) {
        await linkCommand({
          record,
          collector: options.collector,
          contribution
        });
      }
    }
  }
}

async function addInlineCommands(
  record: PluginRecord,
  options: { declared: unknown; collector?: SourceCollector }
): Promise<void> {
  const inline = object(options.declared);
  if (!inline) {
    return;
  }
  for (const [name, value] of Object.entries(inline)) {
    const source = object(value)?.source;
    const path =
      typeof source === "string"
        ? await safePath(record.installPath!, source)
        : undefined;
    const sourcePath =
      path && (await fileExists(path)) ? path : record.sourcePath;
    addContribution(record.contributions, {
      kind: "command",
      name,
      sourcePath
    });
    const contribution = record.contributions.find(
      (item) =>
        item.kind === "command" &&
        item.name === name &&
        item.sourcePath === sourcePath
    );
    if (contribution) {
      await linkCommand({
        record,
        collector: options.collector,
        contribution,
        locator:
          sourcePath === record.sourcePath ? `commands.${name}` : undefined,
        declarationOnly: sourcePath === record.sourcePath
      });
    }
  }
}

export async function addPluginCommands(
  record: PluginRecord,
  options: { manifest: JsonMap; collector?: SourceCollector; errors: string[] }
): Promise<void> {
  if (!record.installPath) {
    return;
  }
  const declared = options.manifest.commands;
  await addCommandFiles(record, {
    locations: declared === undefined ? ["./commands"] : paths(declared),
    collector: options.collector,
    errors: options.errors
  });
  await addInlineCommands(record, {
    declared,
    collector: options.collector
  });
}
