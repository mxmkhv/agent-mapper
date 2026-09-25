import { expect, it } from "vitest";
import { resolveInventory, type InventoryEntry } from "./inventory";

const entry = (overrides: Partial<InventoryEntry>): InventoryEntry => ({
  id: "one",
  tool: "codex",
  kind: "instruction",
  name: "AGENTS.md",
  path: "/work/AGENTS.md",
  scope: "project",
  readState: "readable",
  isSymlink: false,
  ...overrides
});

it("applies ancestor instructions and excludes sibling projects", () => {
  const results = resolveInventory(
    [
      entry({ id: "parent", path: "/work/AGENTS.md" }),
      entry({ id: "nested", path: "/work/app/AGENTS.md" }),
      entry({ id: "sibling", path: "/work/other/AGENTS.md" })
    ],
    { workingDirectory: "/work/app/src", tool: "codex" }
  );

  expect(
    results.map(({ entry: item, resolution }) => [
      item.id,
      resolution.availability
    ])
  ).toEqual([
    ["parent", "expected"],
    ["nested", "expected"],
    ["sibling", "not-applicable"]
  ]);
});

it("keeps unknown loading visible when a source cannot be read", () => {
  const [result] = resolveInventory([entry({ readState: "unreadable" })], {
    workingDirectory: "/work",
    tool: "codex"
  });
  expect(result?.resolution).toMatchObject({
    availability: "unknown",
    loading: "unknown"
  });
  expect(result?.resolution.reason).toContain("unreadable");
});

it("keeps skills available on demand without counting their bodies as startup", () => {
  const [result] = resolveInventory(
    [
      entry({
        kind: "skill",
        path: "/work/.agents/skills/review/SKILL.md",
        projectPath: "/work",
        name: "review",
        characters: 800
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(result?.resolution).toMatchObject({
    availability: "expected",
    loading: "agent-selected",
    estimatedTokens: { startup: 0, onDemand: 200 }
  });
});

it("shows Codex's same-folder override as the winner", () => {
  const results = resolveInventory(
    [
      entry({ id: "normal", characters: 12 }),
      entry({
        id: "override",
        name: "AGENTS.override.md",
        path: "/work/AGENTS.override.md",
        characters: 20
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(
    results.map((result) => [result.entry.id, result.resolution.availability])
  ).toEqual([
    ["normal", "shadowed"],
    ["override", "expected"]
  ]);
  expect(results[0]?.resolution.reason).toContain("AGENTS.override.md");
});

it("uses Claude's project AGENTS fallback only without a project CLAUDE file", () => {
  const agent = entry({ id: "claude-agent", tool: "claude", characters: 20 });
  const claude = entry({
    id: "claude-md",
    tool: "claude",
    name: "CLAUDE.md",
    path: "/work/CLAUDE.md",
    characters: 20
  });
  expect(
    resolveInventory([agent], { workingDirectory: "/work", tool: "claude" })[0]
      ?.resolution.availability
  ).toBe("expected");
  expect(
    resolveInventory([agent, claude], {
      workingDirectory: "/work",
      tool: "claude"
    })[0]?.resolution.availability
  ).toBe("shadowed");
});
