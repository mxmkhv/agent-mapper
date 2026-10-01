import { expect, it } from "vitest";
import { tildeText } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import {
  clusterBySource,
  groupRecords,
  kindCounts,
  sharedSources
} from "./inventory-groups";
import { searchRecords } from "./search";

function record(
  input: Partial<InventoryRecord> &
    Pick<InventoryRecord, "id" | "name" | "layer">
): InventoryRecord {
  return {
    kind: "skill",
    tool: "claude",
    path: `/repo/${input.name}`,
    realPath: `/repo/${input.name}`,
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

const plugin = {
  id: "p1",
  name: "review-kit",
  version: "1.2.3",
  state: "selected"
};
const records = [
  record({ id: "project-skill", name: "zeta", layer: "project" }),
  record({ id: "plugin-skill", name: "review", layer: "plugins", plugin }),
  record({
    id: "installed",
    name: "review-kit",
    kind: "plugin",
    layer: "plugins"
  }),
  record({
    id: "global-instruction",
    name: "CLAUDE.md",
    kind: "instruction",
    layer: "global"
  }),
  record({ id: "global-skill", name: "alpha", layer: "global" }),
  record({
    id: "local",
    name: "CLAUDE.local.md",
    kind: "instruction",
    layer: "user"
  })
];

it("orders groups by the layer stack and kinds within a group", () => {
  const groups = groupRecords(records);
  expect(groups.map((group) => group.label)).toEqual([
    "Global",
    "Installed plugins",
    "review-kit",
    "Project",
    "User"
  ]);
  expect(groups[0]?.records.map((item) => item.id)).toEqual([
    "global-instruction",
    "global-skill"
  ]);
  expect(groups[2]?.plugin).toEqual({ name: "review-kit", version: "1.2.3" });
});

it("lists only source repos shared by several skills, largest first", () => {
  const from = (id: string, repo?: string) =>
    record({
      id,
      name: id,
      layer: "project",
      installedFrom: repo ? { repo } : undefined
    });
  expect(
    sharedSources([
      from("a", "maplibre/skills"),
      from("b", "software-mansion/argent"),
      from("c", "software-mansion/argent"),
      from("d", "maplibre/skills"),
      from("e", "software-mansion/argent"),
      from("f", "expo/skills"),
      from("g")
    ])
  ).toEqual([
    { repo: "software-mansion/argent", count: 3 },
    { repo: "maplibre/skills", count: 2 }
  ]);
});

it("gathers a shared repo's skills where the first of them sits", () => {
  const from = (id: string, repo?: string) =>
    record({
      id,
      name: id,
      layer: "project",
      installedFrom: repo ? { repo } : undefined
    });
  const clusters = clusterBySource([
    from("a"),
    from("b", "software-mansion/argent"),
    from("c", "expo/skills"),
    from("d", "software-mansion/argent")
  ]);
  expect(
    clusters.map(({ source, records }) => [
      source?.repo,
      records.map((item) => item.id)
    ])
  ).toEqual([
    [undefined, ["a"]],
    ["software-mansion/argent", ["b", "d"]],
    [undefined, ["c"]]
  ]);
  expect(clusters[1]?.source).toMatchObject({ count: 2, tone: 0 });
});

it("counts kinds in display order", () => {
  expect(kindCounts(records)).toEqual([
    ["instruction", 2],
    ["skill", 3],
    ["plugin", 1]
  ]);
});

it("matches every search term and lists inactive results last", () => {
  const found = searchRecords(
    [
      record({ id: "old", name: "review", layer: "plugins", tier: "inactive" }),
      ...records
    ],
    "review"
  );
  expect(found.map((item) => item.id)).toEqual([
    "plugin-skill",
    "installed",
    "old"
  ]);
});

it("shortens home paths anywhere in resolver prose", () => {
  expect(
    tildeText("Claude Code uses /Users/dev/app/CLAUDE.md here", {
      home: "/Users/dev"
    })
  ).toBe("Claude Code uses ~/app/CLAUDE.md here");
});
