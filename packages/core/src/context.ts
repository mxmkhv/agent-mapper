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

function tokenEstimate(characters: number): number {
  return Math.round(characters / charactersPerToken);
}

function addEntry(
  characters: ContextSummary,
  { entry, resolution }: ResolvedEntry
): void {
  const total = characters[entry.tool];
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
    } else if (entry.kind === "skill" || entry.kind === "command") {
      const metadata = entry.metadataCharacters ?? 0;
      total.skillMetadata += metadata;
      total.onDemand += Math.max(0, (entry.characters ?? 0) - metadata);
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
