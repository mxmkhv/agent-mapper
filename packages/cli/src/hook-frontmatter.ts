import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import type {
  AgentRecord,
  HookRecord,
  InventoryEntry,
  PluginRecord
} from "@agent-mapper/core";
import { addGroups, type HookSource } from "./hook-record";
import { object } from "./plugin-reader-common";

const maxHeaderCharacters = 1_000_000;
const frontmatterStartLength = 4;

function header(content: string): string | undefined {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return undefined;
  }
  const end = /^---[ \t]*$/gm.exec(normalized.slice(frontmatterStartLength));
  return end
    ? normalized.slice(
        frontmatterStartLength,
        end.index + frontmatterStartLength
      )
    : undefined;
}

async function hookEvents(
  path: string,
  errors: string[]
): Promise<ReturnType<typeof object>> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    errors.push(`${path}: Could not read hook frontmatter. Check permissions.`);
    return undefined;
  }
  const frontmatter = header(content);
  if (!frontmatter || !/^hooks\s*:/m.test(frontmatter)) {
    return undefined;
  }
  if (frontmatter.length > maxHeaderCharacters) {
    errors.push(`${path}: Hook frontmatter is too large to inspect.`);
    return undefined;
  }
  try {
    const document = parseDocument(frontmatter, { uniqueKeys: true });
    if (document.errors.length) {
      errors.push(`${path}: Could not parse hook frontmatter YAML.`);
      return undefined;
    }
    const data = object(document.toJS({ maxAliasCount: 0 }));
    const events = object(data?.hooks);
    if (!events) {
      errors.push(`${path}: Hook frontmatter must contain an event map.`);
    }
    return events;
  } catch {
    errors.push(`${path}: Could not parse hook frontmatter YAML.`);
    return undefined;
  }
}

function skillSources(
  entries: InventoryEntry[],
  plugins: PluginRecord[]
): HookSource[] {
  return entries
    .filter(
      (entry): entry is InventoryEntry & { scope: HookSource["scope"] } =>
        entry.tool === "claude" &&
        entry.kind === "skill" &&
        entry.readState === "readable" &&
        entry.scope !== "managed"
    )
    .map((entry) => ({
      path: entry.path,
      tool: "claude" as const,
      scope: entry.scope,
      plugin: plugins.find((plugin) => plugin.id === entry.pluginId),
      condition:
        "Registers when this skill is invoked and remains for the session; live invocation is not verified.",
      locatorPrefix: "frontmatter.hooks"
    }));
}

function agentSources(
  agents: AgentRecord[],
  plugins: PluginRecord[]
): HookSource[] {
  return agents
    .filter(
      (agent) =>
        agent.tool === "claude" &&
        agent.format === "markdown" &&
        agent.readState === "readable"
    )
    .map((agent) => ({
      path: agent.sourcePath,
      tool: "claude" as const,
      scope: agent.scope,
      plugin: plugins.find((plugin) => plugin.id === agent.pluginId),
      condition:
        agent.scope === "project"
          ? "Runs while this agent is active; project folder trust is not verified."
          : "Runs while this agent is active; live use is not verified.",
      unknownReason:
        agent.availability === "configured" ? undefined : agent.reason,
      locatorPrefix: "frontmatter.hooks"
    }));
}

export async function addFrontmatterHooks(
  hooks: HookRecord[],
  options: {
    entries: InventoryEntry[];
    agents: AgentRecord[];
    plugins: PluginRecord[];
    errors: string[];
  }
): Promise<void> {
  const sources = [
    ...skillSources(options.entries, options.plugins),
    ...agentSources(options.agents, options.plugins)
  ];
  for (const source of sources) {
    const events = await hookEvents(source.path, options.errors);
    if (events) {
      addGroups(hooks, { source, events });
    }
  }
}
