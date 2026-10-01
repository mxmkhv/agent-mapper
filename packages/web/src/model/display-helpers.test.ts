import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { expect, it } from "vitest";
import { diffStats } from "../documents/diff-stats";
import { sizeText } from "../inspector/inspector-sections";
import type { InventoryRecord } from "./record-types";

const home = "/Users/dev";

function skill(id: string, path: string): InventoryRecord {
  return {
    id,
    kind: "skill",
    tool: "codex",
    name: "react-render-skill",
    path,
    realPath: path,
    scope: "global",
    layer: "global",
    tier: "active",
    label: "expected",
    reason: "Fixture",
    order: 0,
    startupTokens: 0,
    details: [],
    problems: []
  };
}

it("counts a replaced line once and pure inserts and deletes on one side", () => {
  const lines = (count: number) =>
    Array.from({ length: count }, (_, index) => `line ${index + 1}`);
  const before = lines(24);
  const after = [...before];
  // Replace two lines with three, insert one, delete two.
  after.splice(3, 2, "new 4", "new 5", "new 6");
  after.splice(10, 0, "inserted");
  after.splice(20, 2);
  const original = Text.of(before);
  const modified = Text.of(after);
  const chunks = Chunk.build(original, modified);
  expect(diffStats({ chunks, original, modified })).toEqual({
    changed: 6,
    added: 4,
    removed: 4
  });
});

it("counts a change on the last line, which has no line break after it", () => {
  const original = Text.of(["a", "b"]);
  const modified = Text.of(["a", "c"]);
  const chunks = Chunk.build(original, modified);
  expect(diffStats({ chunks, original, modified })).toEqual({
    changed: 1,
    added: 1,
    removed: 1
  });
});

it("sizes files by tokens when characters are known, otherwise by bytes", () => {
  const base = skill("s", `${home}/.codex/skills/x/SKILL.md`);
  expect(sizeText({ ...base, lines: 36, characters: 2364 })).toBe(
    "36 lines · ~591 tokens"
  );
  expect(sizeText({ ...base, lines: 16, bytes: 1434 })).toBe(
    "16 lines · 1.4 KB"
  );
  expect(sizeText({ ...base, bytes: 1023 })).toBe("1023 B");
  expect(sizeText(base)).toBeUndefined();
});
