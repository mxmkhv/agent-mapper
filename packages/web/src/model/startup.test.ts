import { expect, it } from "vitest";
import type { InventoryRecord } from "./record-types";
import { approxTokens, startupFiles } from "./startup";

function instruction(
  input: Partial<InventoryRecord> & Pick<InventoryRecord, "id" | "order">
): InventoryRecord {
  return {
    kind: "instruction",
    tool: "claude",
    name: input.id,
    path: `/repo/${input.id}`,
    realPath: `/repo/${input.id}`,
    scope: "project",
    layer: "project",
    tier: "active",
    label: "expected",
    reason: "Fixture",
    loading: "startup",
    startupTokens: 0,
    details: [],
    problems: [],
    ...input
  };
}

it("lists startup instructions in load order and leaves out what does not load", () => {
  const records = [
    instruction({ id: "project", order: 2 }),
    instruction({ id: "global", order: 1, layer: "global" }),
    instruction({ id: "shadowed", order: 3, tier: "inactive" }),
    instruction({ id: "skill", order: 4, kind: "skill", loading: "on demand" })
  ];
  expect(startupFiles(records).map((record) => record.id)).toEqual([
    "global",
    "project"
  ]);
});

it("formats approximate token counts", () => {
  expect(approxTokens(591)).toBe("~591");
  expect(approxTokens(1740)).toBe("~1.7k");
  expect(approxTokens(101_981)).toBe("~102k");
});
