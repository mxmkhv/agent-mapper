import { expect, it } from "vitest";
import type { AgentRecord, MemoryRecord, ResolvedEntry } from "./inventory";
import { summarizeContext } from "./context";

function item(
  id: string,
  options: {
    tool: "claude" | "codex";
    kind: "instruction" | "skill";
    characters: number;
    metadataCharacters?: number;
  }
): ResolvedEntry {
  return {
    entry: {
      id,
      tool: options.tool,
      kind: options.kind,
      name: id,
      path: `/app/${id}`,
      scope: "project",
      readState: "readable",
      isSymlink: false,
      characters: options.characters,
      metadataCharacters: options.metadataCharacters ?? 0
    },
    resolution: {
      availability: "expected",
      loading: options.kind === "skill" ? "agent-selected" : "startup",
      reason: "Fixture"
    }
  };
}

function configuredAgent(): AgentRecord {
  return {
    id: "agent",
    tool: "claude",
    name: "reviewer",
    scope: "project",
    format: "markdown",
    sourcePath: "/app/reviewer.md",
    locator: "frontmatter",
    descriptionPresent: true,
    readState: "readable",
    availability: "configured",
    reason: "Fixture",
    characters: 240
  };
}

it("separates startup text, skill listing metadata, and available on-demand text", () => {
  const items = [
    item("instruction", {
      tool: "claude",
      kind: "instruction",
      characters: 400
    }),
    item("skill", {
      tool: "claude",
      kind: "skill",
      characters: 520,
      metadataCharacters: 120
    }),
    item("codex", { tool: "codex", kind: "instruction", characters: 80 }),
    {
      ...item("shadowed", {
        tool: "claude",
        kind: "instruction",
        characters: 800
      }),
      resolution: {
        availability: "shadowed" as const,
        loading: "not-applicable" as const,
        reason: "Fixture"
      }
    }
  ];
  expect(
    summarizeContext({ items, agents: [configuredAgent()], memories: [] })
  ).toEqual({
    claude: {
      startup: 100,
      skillMetadata: 30,
      onDemand: 160,
      unaccountedSources: 0
    },
    codex: {
      startup: 20,
      skillMetadata: 0,
      onDemand: 0,
      unaccountedSources: 0
    }
  });
});

it("counts unresolved sources without assigning them estimated tokens", () => {
  const unknown = {
    ...item("unreadable", {
      tool: "codex",
      kind: "instruction",
      characters: 0
    }),
    resolution: {
      availability: "unknown" as const,
      loading: "unknown" as const,
      reason: "Fixture"
    }
  };
  const memory: MemoryRecord = {
    id: "memory",
    tool: "codex",
    name: "note.md",
    sourcePath: "/app/note.md",
    scope: "project",
    projectMatch: "matched",
    loading: "unknown",
    readState: "readable",
    modifiedAt: "2026-01-01T00:00:00.000Z",
    reason: "Fixture"
  };
  const result = summarizeContext({
    items: [unknown],
    agents: [],
    memories: [memory]
  });
  expect(result.codex).toMatchObject({
    startup: 0,
    onDemand: 0,
    unaccountedSources: 2
  });
});
