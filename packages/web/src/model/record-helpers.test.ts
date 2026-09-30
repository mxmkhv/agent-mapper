import { expect, it } from "vitest";
import { coverageAreas, coverageProblems } from "@agent-mapper/core";
import { isConventionalPath } from "./conventional-path";
import { foldInactive } from "./plugin-versions";
import type { InventoryRecord } from "./record-types";

const home = "/Users/dev";
const context = { home, projectRoot: `${home}/code/app` };

function record(
  input: Partial<InventoryRecord> & Pick<InventoryRecord, "id" | "path">
): InventoryRecord {
  return {
    kind: "skill",
    tool: "claude",
    name: input.id,
    realPath: input.path,
    scope: "global",
    layer: "global",
    tier: "active",
    label: "expected",
    reason: "Fixture",
    order: 0,
    startupTokens: 0,
    details: [],
    problems: [],
    ...input
  };
}

it("hides paths that only repeat the item name and its folder", () => {
  const conventional = [
    record({ id: "bro", path: `${home}/.claude/skills/bro/SKILL.md` }),
    record({
      id: "reviewer",
      kind: "agent",
      path: `${home}/.codex/agents/reviewer.toml`
    }),
    record({
      id: "claude",
      kind: "instruction",
      name: "CLAUDE.md",
      path: `${home}/.claude/CLAUDE.md`
    }),
    record({
      id: "project",
      kind: "instruction",
      name: "AGENTS.md",
      path: `${home}/code/app/AGENTS.md`
    })
  ];
  expect(conventional.map((item) => isConventionalPath(item, context))).toEqual(
    [true, true, true, true]
  );
});

it("keeps paths that say something the name does not", () => {
  const telling = [
    record({
      id: "vercel-react-best-practices",
      path: `${home}/.claude/skills/react-best-practices/SKILL.md`
    }),
    record({
      id: "nested",
      kind: "instruction",
      name: "CLAUDE.md",
      path: `${home}/code/app/packages/web/CLAUDE.md`
    }),
    record({ id: "notes", kind: "memory", path: `${home}/notes.md` })
  ];
  expect(telling.map((item) => isConventionalPath(item, context))).toEqual([
    false,
    false,
    false
  ]);
});

it("folds background plugin versions and what they declare into the selected one", () => {
  const selected = record({
    id: "context7@new",
    kind: "plugin",
    name: "context7",
    path: "/cache/new"
  });
  const candidate = {
    ...selected,
    id: "context7@old",
    tier: "unknown" as const
  };
  const cached = {
    ...selected,
    id: "context7@older",
    tier: "inactive" as const
  };
  const declared = record({
    id: "context7-mcp",
    kind: "mcp",
    path: "/cache/old/.mcp.json",
    tier: "unknown",
    plugin: { id: "context7@old", name: "context7", state: "unknown" }
  });
  const all = [selected, candidate, cached, declared];
  const { hidden, otherVersions } = foldInactive(all);
  expect(all.map((item) => hidden(item))).toEqual([false, true, true, true]);
  expect(otherVersions.get("context7")).toBe(2);
});

it("keeps an unknown plugin visible when no version is selected", () => {
  const only = record({
    id: "solo",
    kind: "plugin",
    path: "/cache/solo",
    tier: "unknown"
  });
  expect(foldInactive([only]).hidden(only)).toBe(false);
});

it("separates scan problems from the fixed coverage notes", () => {
  const problem = "/Users/dev/.claude/settings.json: Expected a JSON object.";
  expect(
    coverageProblems([problem, ...coverageAreas.map((area) => area.detail)])
  ).toEqual([problem]);
});
