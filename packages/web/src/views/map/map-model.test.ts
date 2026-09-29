import { expect, it } from "vitest";
import type { InventoryRecord } from "../../model/record-types";
import { approxTokens, buildMap, loadOrder, startupFiles } from "./map-model";

function record(
  input: Partial<InventoryRecord> & Pick<InventoryRecord, "id" | "layer">
): InventoryRecord {
  return {
    kind: "skill",
    tool: "claude",
    name: input.id,
    path: `/repo/${input.id}`,
    realPath: `/repo/${input.id}`,
    scope: "project",
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

const instruction = ({
  id,
  layer,
  order
}: Pick<InventoryRecord, "id" | "layer" | "order">) =>
  record({
    id,
    layer,
    kind: "instruction",
    loading: "startup",
    order,
    startupTokens: 100 * order
  });

const records = [
  instruction({ id: "project-claude", layer: "project", order: 2 }),
  instruction({ id: "global-claude", layer: "global", order: 1 }),
  record({
    id: "shadowed",
    layer: "project",
    kind: "instruction",
    tier: "inactive",
    label: "shadowed",
    order: 3
  }),
  record({ id: "skill", layer: "global", order: 4 }),
  record({
    id: "plugin-skill",
    layer: "plugins",
    plugin: { id: "p", name: "kit", state: "selected" }
  }),
  record({ id: "kit", layer: "plugins", kind: "plugin" }),
  record({
    id: "kit-candidate",
    name: "kit",
    layer: "plugins",
    kind: "plugin",
    tier: "unknown",
    label: "unknown"
  }),
  record({
    id: "old-kit",
    layer: "plugins",
    kind: "plugin",
    tier: "inactive",
    label: "cached"
  })
];

it("stacks Global, Plugins, Project, User and skips Managed when empty", () => {
  expect(buildMap(records, false).map((layer) => layer.layer)).toEqual([
    "global",
    "plugins",
    "project",
    "user"
  ]);
});

it("hides inactive items until asked and counts hidden plugin versions", () => {
  const [, plugins, project] = buildMap(records, false);
  expect(project?.kinds[0]?.records.map((item) => item.id)).toEqual([
    "project-claude"
  ]);
  expect(plugins?.plugins.map((item) => item.id)).toEqual(["kit"]);
  // The cached version and the unconfirmed duplicate of a selected plugin both stay out of the way.
  expect(plugins?.hiddenPlugins).toBe(2);
  expect(plugins?.kinds).toEqual([]);
  const [, , withInactive] = buildMap(records, true);
  expect(withInactive?.kinds[0]?.records.map((item) => item.id)).toEqual([
    "project-claude",
    "shadowed"
  ]);
});

it("numbers startup instructions in load order across layers", () => {
  expect([...loadOrder(records)]).toEqual([
    ["global-claude", 1],
    ["project-claude", 2]
  ]);
  expect(startupFiles(records).map((item) => item.id)).toEqual([
    "global-claude",
    "project-claude"
  ]);
});

it("formats approximate token counts", () => {
  expect(approxTokens(591)).toBe("~591");
  expect(approxTokens(1740)).toBe("~1.7k");
  expect(approxTokens(101_981)).toBe("~102k");
});
