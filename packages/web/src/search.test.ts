import { expect, it } from "vitest";
import type { InventorySnapshot } from "@agent-mapper/core";
import { searchItems } from "./search";

const snapshot: InventorySnapshot = {
  workingDirectory: "/app",
  scannedAt: "2026-01-01T00:00:00.000Z",
  roots: { claude: "/home/.claude", codex: "/home/.codex" },
  items: [
    {
      entry: {
        id: "skill",
        tool: "claude",
        kind: "skill",
        name: "review",
        path: "/app/.claude/skills/review/SKILL.md",
        scope: "project",
        readState: "readable",
        isSymlink: false
      },
      resolution: {
        availability: "expected",
        loading: "agent-selected",
        reason: "Fixture"
      }
    }
  ],
  plugins: [],
  hooks: [],
  mcpServers: [
    {
      id: "mcp",
      tool: "codex",
      name: "docs",
      scope: "global",
      sourcePath: "/home/.codex/config.toml",
      locator: "mcp_servers.docs",
      transport: "stdio",
      destination: "redacted",
      envNames: [],
      headerNames: [],
      availability: "configured",
      reason: "Fixture"
    }
  ],
  memories: [],
  agents: [],
  context: {
    claude: {
      startup: 0,
      skillMetadata: 0,
      onDemand: 0,
      unaccountedSources: 0
    },
    codex: { startup: 0, skillMetadata: 0, onDemand: 0, unaccountedSources: 0 }
  },
  worktrees: [],
  coverage: []
};

it("finds items across tabs by name or source path without searching content", () => {
  expect(
    searchItems(snapshot, { query: "review", tool: "all" }).map(
      (item) => item.tab
    )
  ).toEqual(["skill"]);
  expect(
    searchItems(snapshot, { query: "config.toml", tool: "all" }).map(
      (item) => item.tab
    )
  ).toEqual(["mcp"]);
  expect(searchItems(snapshot, { query: "redacted", tool: "all" })).toEqual([]);
});

it("applies the tool filter across all result kinds", () => {
  expect(
    searchItems(snapshot, { query: "", tool: "codex" }).map((item) => item.id)
  ).toEqual(["mcp"]);
  expect(
    searchItems(snapshot, { query: "", tool: "claude" }).map((item) => item.id)
  ).toEqual(["skill"]);
});
