import { join } from "node:path";
import type { McpRecord } from "@agent-mapper/core";
import type { ManagedSettingsFile } from "./managed-claude-reader";
import { add, type Source } from "./mcp-record";
import { json, object, type JsonMap } from "./plugin-reader-common";

function managedSource(path: string, kind: Source["managedKind"]): Source {
  return { path, tool: "claude", scope: "managed", managedKind: kind };
}

function addDeclarations(
  records: McpRecord[],
  options: { path: string; kind: Source["managedKind"]; values: JsonMap }
): void {
  const prefix =
    options.kind === "exclusive" ? "mcpServers" : "managedMcpServers";
  for (const [name, value] of Object.entries(options.values)) {
    add(records, {
      source: managedSource(options.path, options.kind),
      name,
      value,
      locator: `${prefix}.${name}`
    });
  }
}

function addProvided(
  records: McpRecord[],
  options: { settings: ManagedSettingsFile[]; errors: string[] }
): void {
  const selected = new Map<string, McpRecord>();
  for (const file of options.settings) {
    const raw = file.data.managedMcpServers;
    if (raw === undefined) {
      continue;
    }
    const values = object(raw);
    if (!values) {
      options.errors.push(`${file.path}: managedMcpServers must be an object.`);
      continue;
    }
    for (const [name, value] of Object.entries(values)) {
      const previous = selected.get(name);
      if (previous) {
        previous.availability = "shadowed";
        previous.reason = `Later local managed setting replaces this server: ${file.path}`;
      }
      addDeclarations(records, {
        path: file.path,
        kind: "provided",
        values: { [name]: value }
      });
      const current = records.at(-1);
      if (current) {
        if (previous) {
          previous.shadowedBy = current.id;
        }
        selected.set(name, current);
      }
    }
  }
}

function markOrdinary(
  records: McpRecord[],
  options: { exclusivePath?: string; managedNames: Set<string> }
): void {
  for (const record of records) {
    if (record.tool !== "claude" || record.scope === "managed") {
      continue;
    }
    if (options.exclusivePath) {
      record.availability = "shadowed";
      record.reason = `Local managed MCP policy excludes ordinary sources if selected: ${options.exclusivePath}`;
      // The policy, not another declaration, excludes it; an earlier link to a winner no longer applies.
      record.shadowedBy = undefined;
    } else if (
      options.managedNames.has(record.name) &&
      record.availability !== "disabled" &&
      record.availability !== "shadowed"
    ) {
      record.availability = "unknown";
      record.reason =
        "A local managed provided server may take precedence if that policy is selected.";
    }
  }
}

export async function addManagedMcp(
  records: McpRecord[],
  options: {
    directory: string;
    settings: ManagedSettingsFile[];
    errors: string[];
  }
): Promise<void> {
  const path = join(options.directory, "managed-mcp.json");
  const data = await json(path, options.errors);
  const exclusive = data ? object(data.mcpServers) : undefined;
  if (data && !exclusive) {
    options.errors.push(`${path}: mcpServers must be an object.`);
  }
  const ordinaryCount = records.length;
  addProvided(records, options);
  const provided = records.slice(ordinaryCount);
  if (exclusive) {
    addDeclarations(records, { path, kind: "exclusive", values: exclusive });
    const declared = records.slice(ordinaryCount + provided.length);
    for (const record of provided) {
      if (Object.hasOwn(exclusive, record.name)) {
        record.availability = "shadowed";
        record.reason = `Local managed-mcp.json replaces this provided server: ${path}`;
        record.shadowedBy = declared.find(
          (winner) => winner.name === record.name
        )?.id;
      }
    }
  }
  const managedNames = new Set(provided.map((record) => record.name));
  markOrdinary(records, {
    exclusivePath: exclusive ? path : undefined,
    managedNames
  });
}
