import { expect, it } from "vitest";
import type { ResolvedEntry, SkillSource } from "@agent-mapper/core";
import { entryDraft } from "./record-sources";

function skill(installedFrom?: SkillSource): ResolvedEntry {
  return {
    entry: {
      id: "skill",
      tool: "claude",
      kind: "skill",
      name: "lens",
      path: "/repo/.claude/skills/lens/SKILL.md",
      scope: "project",
      readState: "readable",
      isSymlink: false,
      installedFrom
    },
    resolution: {
      availability: "expected",
      loading: "agent-selected",
      reason: "Fixture"
    }
  };
}

function installedFromDetail(source?: SkillSource): string | undefined {
  return entryDraft(skill(source), 0).details.find(
    (detail) => detail.label === "Installed from"
  )?.value;
}

it("shows a skill's source repo, with its ref when pinned", () => {
  const pinned = { repo: "software-mansion/argent", ref: "v0.22.1" };
  expect(entryDraft(skill(pinned), 0).installedFrom).toEqual(pinned);
  expect(installedFromDetail(pinned)).toBe("software-mansion/argent @ v0.22.1");
  expect(installedFromDetail({ repo: "expo/skills" })).toBe("expo/skills");
  expect(installedFromDetail()).toBeUndefined();
});
