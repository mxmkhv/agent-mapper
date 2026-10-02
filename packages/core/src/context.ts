import type {
  AgentRecord,
  MemoryRecord,
  ResolvedEntry,
  ToolId
} from "./inventory";

interface ContextEstimate {
  startup: number;
  skillMetadata: number;
  onDemand: number;
  unaccountedSources: number;
}

export type ContextSummary = Record<ToolId, ContextEstimate>;
const charactersPerToken = 4;

interface ContextSources {
  items: readonly ResolvedEntry[];
  agents: readonly AgentRecord[];
  memories: readonly MemoryRecord[];
}

function emptyEstimate(): ContextEstimate {
  return { startup: 0, skillMetadata: 0, onDemand: 0, unaccountedSources: 0 };
}

export function tokenEstimate(characters: number): number {
  return Math.round(characters / charactersPerToken);
}

/**
 * Frontmatter characters an expected skill or command adds to every session's skill index, the listing the model
 * reads to decide when to use one. Undefined when it adds none.
 */
export function skillIndexCharacters({
  entry,
  resolution
}: ResolvedEntry): number | undefined {
  if (
    resolution.availability !== "expected" ||
    entry.declarationOnly ||
    (entry.kind !== "skill" && entry.kind !== "command")
  ) {
    return undefined;
  }
  return entry.metadataCharacters ?? 0;
}

function addEntry(characters: ContextSummary, item: ResolvedEntry): void {
  const { entry, resolution } = item;
  const total = characters[entry.tool];
  const index = skillIndexCharacters(item);
  if (resolution.availability === "unknown") {
    total.unaccountedSources += 1;
  } else if (resolution.availability === "expected") {
    if (entry.declarationOnly) {
      total.unaccountedSources += 1;
    } else if (
      entry.kind === "instruction" &&
      resolution.loading === "startup"
    ) {
      total.startup += entry.characters ?? 0;
    } else if (index !== undefined) {
      total.skillMetadata += index;
      total.onDemand += Math.max(0, (entry.characters ?? 0) - index);
    }
  }
}

export function summarizeContext(sources: ContextSources): ContextSummary {
  const characters = {
    claude: emptyEstimate(),
    codex: emptyEstimate()
  };
  for (const item of sources.items) {
    addEntry(characters, item);
  }
  for (const agent of sources.agents) {
    const total = characters[agent.tool];
    if (agent.availability === "configured" && agent.characters !== undefined) {
      total.onDemand += agent.characters;
    } else if (agent.availability === "unknown") {
      total.unaccountedSources += 1;
    }
  }
  for (const memory of sources.memories) {
    if (memory.tool !== "unknown") {
      characters[memory.tool].unaccountedSources += 1;
    }
  }
  return {
    claude: {
      startup: tokenEstimate(characters.claude.startup),
      skillMetadata: tokenEstimate(characters.claude.skillMetadata),
      onDemand: tokenEstimate(characters.claude.onDemand),
      unaccountedSources: characters.claude.unaccountedSources
    },
    codex: {
      startup: tokenEstimate(characters.codex.startup),
      skillMetadata: tokenEstimate(characters.codex.skillMetadata),
      onDemand: tokenEstimate(characters.codex.onDemand),
      unaccountedSources: characters.codex.unaccountedSources
    }
  };
}
