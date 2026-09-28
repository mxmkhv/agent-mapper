import { expect, it } from "vitest";
import type { WorktreeDifference } from "@agent-mapper/core";
import { groupDifferences } from "./difference-groups";

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
