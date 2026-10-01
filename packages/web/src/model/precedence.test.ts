import type { Finding } from "@agent-mapper/core";
import { expect, it } from "vitest";
import { precedenceOf, relationLabels } from "./precedence";
import type { InventoryRecord } from "./record-types";

function record(
  input: Partial<InventoryRecord> & Pick<InventoryRecord, "id" | "name">
): InventoryRecord {
  return {
    kind: "instruction",
    tool: "codex",
    path: `/repo/${input.id}`,
    realPath: `/repo/${input.id}`,
    scope: "project",
    layer: "project",
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

const winner = record({ id: "override", name: "AGENTS.override.md" });
const loser = record({
  id: "agents",
  name: "AGENTS.md",
  tier: "inactive",
  label: "shadowed",
  shadowedBy: "override"
});
const skillA = record({ id: "a", name: "review", kind: "skill" });
const skillB = record({ id: "b", name: "review", kind: "skill" });
const plain = record({ id: "plain", name: "notes", kind: "skill" });
const records = [winner, loser, skillA, skillB, plain];
const findings: Finding[] = [
  {
    id: "f",
    tool: "codex",
    code: "duplicate-skill-name",
    level: "review",
    title: "Skills share a name",
    reason: "Fixture",
    sources: [
      { id: "a", path: skillA.path },
      { id: "b", path: skillB.path }
    ]
  }
];

it("links an overridden source to its winner and back", () => {
  const scope = { records, findings };
  expect(precedenceOf(loser, scope).overriddenBy?.id).toBe("override");
  expect(precedenceOf(winner, scope).overrides.map((item) => item.id)).toEqual([
    "agents"
  ]);
  expect(precedenceOf(skillA, scope).sameName.map((item) => item.id)).toEqual([
    "b"
  ]);
});

it("labels only winners and shared names; everything else stays quiet", () => {
  expect([...relationLabels({ records, findings })]).toEqual([
    ["override", "overrides AGENTS.md"],
    ["a", "shared name"],
    ["b", "shared name"]
  ]);
});
