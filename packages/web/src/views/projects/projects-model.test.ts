import { expect, it } from "vitest";
import type { InventoryRecord } from "../../model/record-types";
import type { ScannedProject } from "../../model/scanned-project";
import {
  differencesFromGlobal,
  projectOwn,
  startupTokens
} from "./projects-model";

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
const globalMcp = record({
  id: "m",
  kind: "mcp",
  path: "/home/.claude.json",
  locator: "mcpServers.x"
});
const disabledGlobally = record({
  id: "d",
  kind: "mcp",
  path: "/home/.claude.json",
  locator: "mcpServers.y",
  tier: "inactive",
  label: "disabled"
});
const globalRecords = [globalClaude, globalSkill, globalMcp, disabledGlobally];

const app: ScannedProject = {
  name: "app",
  path: "/home/code/app",
  records: [
    globalClaude,
    globalSkill,
    { ...globalMcp, tier: "inactive", label: "disabled" },
    disabledGlobally,
    record({
      id: "own",
      kind: "skill",
      path: "/home/code/app/.claude/skills/b/SKILL.md",
      scope: "project",
      layer: "project"
    }),
    record({
      id: "parent",
      path: "/home/code/CLAUDE.md",
      scope: "project",
      layer: "project"
    })
  ]
};

it("reports nothing for a project that receives every global source as is", () => {
  const same = { ...app, records: [globalClaude, globalSkill, globalMcp] };
  expect(differencesFromGlobal(globalRecords, same)).toEqual([]);
});

it("groups global sources by the state they have in the project", () => {
  const site: ScannedProject = {
    name: "site",
    path: "/home/code/site",
    records: [
      globalClaude,
      { ...globalMcp, tier: "inactive", label: "disabled" }
    ]
  };
  const groups = differencesFromGlobal(globalRecords, site);
  expect(
    groups.map((group) => [
      group.state,
      group.items.map((item) => item.source.id)
    ])
  ).toEqual([
    ["Does not reach", ["s"]],
    ["Disabled", ["m"]]
  ]);
  expect(groups[1]?.items[0]?.match?.tier).toBe("inactive");
});

it("claims no differences for a project that has not been scanned", () => {
  expect(
    differencesFromGlobal(globalRecords, { name: "slow", path: "/slow" })
  ).toEqual([]);
});

it("counts only what the project's own folder adds", () => {
  expect(projectOwn(app, false)).toEqual([["skill", 1]]);
});

it("sums the startup estimate for the selected tool once the project is scanned", () => {
  const estimate = (startup: number) => ({
    startup,
    skillMetadata: 100,
    onDemand: 5000,
    unaccountedSources: 0
  });
  const scanned = {
    ...app,
    context: { claude: estimate(900), codex: estimate(1) }
  };
  expect(startupTokens(scanned, "claude")).toBe(1000);
  expect(
    startupTokens({ name: "slow", path: "/slow" }, "claude")
  ).toBeUndefined();
});
