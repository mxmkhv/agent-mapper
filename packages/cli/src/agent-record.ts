import { createHash } from "node:crypto";
import { lstat, readFile, readlink, realpath } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import type { AgentRecord, PluginRecord } from "@agent-mapper/core";
import { parse } from "smol-toml";

const idLength = 20;
const frontmatterOffset = 4;
export interface AgentSource {
  path: string;
  tool: AgentRecord["tool"];
  scope: AgentRecord["scope"];
  plugin?: PluginRecord;
  pluginName?: string;
}
interface Metadata {
  name?: string;
  descriptionPresent: boolean;
  instructionsPresent: boolean;
  supported: boolean;
}

function scalar(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function markdownMetadata(content: string): Metadata {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return {
      descriptionPresent: false,
      instructionsPresent: false,
      supported: false
    };
  }
  const end = normalized.indexOf("\n---", frontmatterOffset);
  if (end < 0) {
    return {
      descriptionPresent: false,
      instructionsPresent: false,
      supported: false
    };
  }
  const header = normalized.slice(frontmatterOffset, end);
  const name = /^name:\s*(.+)$/m.exec(header)?.[1];
  const description = /^description:\s*(.+)$/m.exec(header)?.[1];
  return {
    name: name ? scalar(name) : undefined,
    descriptionPresent: Boolean(description?.trim()),
    instructionsPresent: true,
    supported: true
  };
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function tomlMetadata(content: string): Metadata {
  let document;
  try {
    document = parse(content);
  } catch {
    return {
      descriptionPresent: false,
      instructionsPresent: false,
      supported: false
    };
  }
  return {
    name: nonEmptyString(document.name),
    descriptionPresent: Boolean(nonEmptyString(document.description)),
    instructionsPresent: Boolean(
      nonEmptyString(document.developer_instructions)
    ),
    supported: true
  };
}

function invalidClaudeName(
  source: AgentSource,
  name: string | undefined
): boolean {
  return (
    source.tool === "claude" &&
    Boolean(name?.startsWith("-") || name?.includes(":"))
  );
}

function unknown(reason: string): Pick<AgentRecord, "availability" | "reason"> {
  return { availability: "unknown", reason };
}

function availability(
  source: AgentSource,
  metadata: Metadata
): Pick<AgentRecord, "availability" | "reason"> {
  if (!metadata.supported) {
    return unknown(
      source.tool === "codex"
        ? "Agent TOML could not be parsed. Fix the syntax and rescan."
        : "Unsupported or missing frontmatter; inspect the source."
    );
  }
  if (!metadata.name && !source.plugin) {
    return unknown("No agent name was found in the declaration.");
  }
  if (invalidClaudeName(source, metadata.name)) {
    return unknown("This agent name is not valid for Claude Code.");
  }
  if (!metadata.descriptionPresent) {
    return unknown("Required description is missing or unsupported.");
  }
  if (source.tool === "codex" && !metadata.instructionsPresent) {
    return unknown(
      "Required developer_instructions is missing or unsupported."
    );
  }
  if (source.plugin && source.plugin.state !== "selected") {
    return unknown("Parent plugin selection is not confirmed.");
  }
  if (source.tool === "codex" && source.scope === "project") {
    return unknown(
      "Project agent is declared, but project trust was not verified."
    );
  }
  return {
    availability: "configured",
    reason:
      "Declared locally; availability in a running session was not checked."
  };
}

/** The inventory ID of the agent declared at `path`; a copied agent gets this ID on the next scan. */
export function agentId(source: {
  tool: AgentRecord["tool"];
  path: string;
  pluginId?: string;
}): string {
  return createHash("sha256")
    .update(`${source.tool}:${source.path}:${source.pluginId ?? ""}`)
    .digest("hex")
    .slice(0, idLength);
}

function baseRecord(source: AgentSource) {
  const format = source.tool === "claude" ? "markdown" : "toml";
  return {
    id: agentId({ ...source, pluginId: source.plugin?.id }),
    tool: source.tool,
    scope: source.scope,
    format,
    sourcePath: source.path,
    locator: format === "markdown" ? "frontmatter" : "top-level keys",
    pluginId: source.plugin?.id
  } as const;
}

/** Where a linked agent file leads. A broken link names its missing target, so it still reads as a link. */
async function linkTarget(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(
        `${path}: Could not resolve this agent link. Check its target and permissions.`,
        { cause: error }
      );
    }
    return resolve(dirname(path), await readlink(path));
  }
}

export async function inspectAgent(
  source: AgentSource
): Promise<AgentRecord | undefined> {
  let info;
  try {
    info = await lstat(source.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw new Error(
      `${source.path}: Could not inspect agent file. Check permissions.`,
      { cause: error }
    );
  }
  if (!info.isFile() && !info.isSymbolicLink()) {
    return undefined;
  }
  const fallback =
    source.pluginName ?? basename(source.path, extname(source.path));
  const base = {
    ...baseRecord(source),
    realPath: info.isSymbolicLink() ? await linkTarget(source.path) : undefined
  };
  try {
    const content = await readFile(source.path, "utf8");
    const metadata =
      base.format === "markdown"
        ? markdownMetadata(content)
        : tomlMetadata(content);
    return {
      ...base,
      name: source.pluginName ?? metadata.name ?? fallback,
      descriptionPresent: metadata.descriptionPresent,
      characters: content.length,
      readState: "readable",
      ...availability(source, metadata)
    };
  } catch {
    return {
      ...base,
      name: fallback,
      descriptionPresent: false,
      readState: "unreadable",
      availability: "unknown",
      reason:
        "Could not read this agent file. Open the source and check its target or permissions."
    };
  }
}
