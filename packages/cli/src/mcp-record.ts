import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { McpRecord, PluginRecord, ToolId } from "@agent-mapper/core";
import { object, type JsonMap } from "./plugin-reader-common";

type Scope = McpRecord["scope"];
export interface Source {
  path: string;
  tool: ToolId;
  scope: Scope;
  plugin?: PluginRecord;
  managedKind?: "exclusive" | "provided";
}

function names(value: unknown): string[] {
  return Object.keys(object(value) ?? {}).filter((name) =>
    /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/.test(name)
  );
}

function destination(
  value: JsonMap,
  transport: McpRecord["transport"]
): string {
  if (transport === "stdio") {
    const command = value.command;
    if (typeof command === "string" && /^[\w./-]+$/.test(command)) {
      return basename(command);
    }
    return "Executable hidden; open source";
  }
  if (typeof value.url === "string") {
    try {
      const url = new URL(value.url);
      if (["https:", "http:"].includes(url.protocol)) {
        return `${url.protocol}//${url.hostname}`;
      }
    } catch {
      // Malformed destinations are represented as unknown below.
    }
  }
  return "Destination hidden; open source";
}

function transport(value: JsonMap): McpRecord["transport"] {
  if (value.type === "streamable-http") {
    return "http";
  }
  if (["stdio", "http", "sse", "ws"].includes(String(value.type))) {
    return value.type as McpRecord["transport"];
  }
  if (value.type !== undefined) {
    return "unknown";
  }
  return typeof value.command === "string" ? "stdio" : "unknown";
}

const idLength = 20;

function configuredState(options: {
  source: Source;
  value?: JsonMap;
  kind: McpRecord["transport"];
}): Pick<McpRecord, "availability" | "reason"> {
  const { source, value, kind } = options;
  if (source.managedKind) {
    return {
      availability: "unknown",
      reason:
        source.managedKind === "exclusive"
          ? "Declared in local managed-mcp.json; runtime filters and connection state are not verified."
          : "Provided by a local managed setting; higher-priority policy selection and connection state are not verified."
    };
  }
  if (value?.enabled === false || source.plugin?.state === "disabled") {
    return {
      availability: "disabled",
      reason: "Disabled in local configuration."
    };
  }
  if (source.plugin && source.plugin.state !== "selected") {
    return {
      availability: "unknown",
      reason: "Plugin selection is not confirmed for this context."
    };
  }
  if (kind === "unknown") {
    return {
      availability: "unknown",
      reason: "Transport or declaration is unsupported; inspect the source."
    };
  }
  if (source.tool === "claude" && source.path.endsWith("/.mcp.json")) {
    return {
      availability: "approval required",
      reason:
        "Project MCP declarations may require Claude Code approval; local approval was not verified."
    };
  }
  return {
    availability: "configured",
    reason:
      "Declared in local configuration; connection and authentication were not checked."
  };
}

function recordTransport(
  source: Source,
  value: JsonMap | undefined
): McpRecord["transport"] {
  if (!value) {
    return "unknown";
  }
  if (
    source.tool === "codex" &&
    typeof value.url === "string" &&
    value.type === undefined
  ) {
    return "http";
  }
  return transport(value);
}

export function add(
  records: McpRecord[],
  options: {
    source: Source;
    name: string;
    value: unknown;
    locator: string;
  }
): void {
  const { source, name, locator } = options;
  const value = object(options.value);
  const kind = recordTransport(source, value);
  records.push({
    id: createHash("sha256")
      .update(
        `${source.tool}:${source.path}:${locator}:${source.plugin?.id ?? ""}`
      )
      .digest("hex")
      .slice(0, idLength),
    tool: source.tool,
    name,
    scope: source.scope,
    sourcePath: source.path,
    locator,
    transport: kind,
    destination: value
      ? destination(value, kind)
      : "Destination hidden; open source",
    envNames: names(value?.env),
    headerNames: names(value?.headers ?? value?.http_headers),
    pluginId: source.plugin?.id,
    ...configuredState({ source, value, kind })
  });
}
