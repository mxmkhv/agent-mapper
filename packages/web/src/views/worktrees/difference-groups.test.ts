import { expect, it } from "vitest";
import type { WorktreeDifference } from "@agent-mapper/core";
import { groupDifferences, relevantDifferences } from "./difference-groups";

const row = (
  relativePath: string,
  state: WorktreeDifference["state"]
): WorktreeDifference => ({
  id: relativePath,
  relativePath,
  kind: "skill",
  tool: "shared",
  state
});

it("treats each skill folder as one item and keeps loose files separate", () => {
  const groups = groupDifferences([
    row(".agents/skills/lens/SKILL.md", "only-main"),
    row(".agents/skills/lens/LICENSE", "only-main"),
    row(".agents/skills/flow/SKILL.md", "different-content"),
    row(".agents/skills/flow/refs/a.md", "only-here"),
    row("AGENTS.md", "different-content")
  ]);
  expect(
    groups.map((group) => [group.label, group.rows.length, group.state])
  ).toEqual([
    [".agents/skills/lens", 2, "only-main"],
    [".agents/skills/flow", 2, "mixed"],
    ["AGENTS.md", 1, "different-content"]
  ]);
});

it("drops system files and keeps shared rows for either tool", () => {
  const rows = [
    row(".agents/skills/.DS_Store", "only-main"),
    row("AGENTS.md", "only-here"),
    {
      ...row(".claude/agents/reviewer.md", "only-main"),
      tool: "claude" as const
    }
  ];
  expect(relevantDifferences(rows, "codex").map((item) => item.id)).toEqual([
    "AGENTS.md"
  ]);
  expect(relevantDifferences(rows, "claude")).toHaveLength(2);
});

it("puts a symlinked skill folder in the same group as its files", () => {
  const [group] = groupDifferences([
    row(".claude/skills/lens", "only-main"),
    row(".claude/skills/lens/SKILL.md", "only-main")
  ]);
  expect(group?.label).toBe(".claude/skills/lens");
  expect(group?.rows).toHaveLength(2);
});
