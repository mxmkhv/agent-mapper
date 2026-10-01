import { expect, it } from "vitest";
import type { InventoryRecord } from "../../model/record-types";
import {
  buildReach,
  projectOwn,
  scanFailed,
  scanPending,
  scanSettled,
  skillReach,
  type ReachProject
} from "./reach-model";

function record(
  input: Partial<InventoryRecord> & Pick<InventoryRecord, "id" | "path">
): InventoryRecord {
  return {
    kind: "instruction",
    tool: "claude",
    name: input.path.split("/").at(-1) ?? input.id,
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

const globalClaude = record({ id: "g", path: "/home/.claude/CLAUDE.md" });
const globalSkill = record({
  id: "s",
  kind: "skill",
  path: "/home/.claude/skills/a/SKILL.md"
});
const disabledMcp = record({
  id: "m",
  kind: "mcp",
  path: "/home/.claude.json",
  locator: "mcpServers.x",
  tier: "inactive",
  label: "disabled"
});
const parentAgents = record({
  id: "p",
  path: "/home/AGENTS.md",
  scope: "project",
  layer: "project",
  tier: "inactive",
  label: "shadowed"
});

const projects: ReachProject[] = [
  {
    name: "app",
    path: "/home/code/app",
    records: [
      globalClaude,
      globalSkill,
      parentAgents,
      record({
        id: "own",
        kind: "skill",
        path: "/home/code/app/.claude/skills/b/SKILL.md",
        scope: "project",
        layer: "project"
      })
    ]
  },
  {
    name: "site",
    path: "/home/code/site",
    records: [globalClaude, parentAgents]
  },
  { name: "slow", path: "/home/code/slow" }
];

it("collapses sources that reach every scanned project and keeps differences visible", () => {
  const sections = buildReach([globalClaude, globalSkill, disabledMcp], {
    projects,
    showInactive: false
  });
  expect(sections).toHaveLength(1);
  expect(sections[0]?.uniform.map((row) => row.record.id)).toEqual(["g"]);
  expect(sections[0]?.varying).toEqual([]);
});

it("adds parent-folder instructions and shows inactive rows on request", () => {
  const sections = buildReach([globalClaude, disabledMcp], {
    projects,
    showInactive: true
  });
  const instructions = sections.find(
    (section) => section.kind === "instruction"
  );
  expect(instructions?.varying.map((row) => row.record.id)).toEqual(["p"]);
  expect(instructions?.varying[0]?.cells.map((cell) => cell?.tier)).toEqual([
    "inactive",
    "inactive",
    undefined
  ]);
  expect(
    sections.find((section) => section.kind === "mcp")?.varying
  ).toHaveLength(1);
});

it("counts global skills and project-only items per project", () => {
  expect(skillReach([globalSkill], projects)).toEqual({
    total: 1,
    counts: [1, 0, 0]
  });
  expect(projectOwn(projects, false)).toEqual([
    { kind: "skill", counts: [1, 0, 0] }
  ]);
});

it("keeps a rescanning project's last records deciding its row", () => {
  const appOnly = record({ id: "x", path: "/home/.claude/rules.md" });
  const sections = buildReach([appOnly], {
    projects: [
      { name: "app", path: "/a", records: [appOnly] },
      { name: "site", path: "/s", records: [], refreshing: true }
    ],
    showInactive: false
  });
  expect(sections[0]?.varying.map((row) => row.record.id)).toEqual(["x"]);
});

it("classifies every scan state as exactly one of settled, pending or failed", () => {
  const states: [ReachProject, "settled" | "pending" | "failed"][] = [
    [{ name: "a", path: "/a", records: [] }, "settled"],
    [{ name: "b", path: "/b", error: "boom" }, "failed"],
    [{ name: "c", path: "/c" }, "pending"],
    [{ name: "d", path: "/d", records: [], refreshing: true }, "pending"],
    [{ name: "e", path: "/e", error: "boom", refreshing: true }, "pending"]
  ];
  for (const [project, state] of states) {
    expect({
      settled: scanSettled(project),
      pending: scanPending(project),
      failed: scanFailed(project)
    }).toEqual({
      settled: state === "settled",
      pending: state === "pending",
      failed: state === "failed"
    });
  }
});
