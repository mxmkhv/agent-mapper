import { Chunk } from "@codemirror/merge";
import { Text } from "@codemirror/state";
import { expect, it } from "vitest";
import { diffConfig, diffStats } from "../documents/diff-stats";
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

it("counts text added after a last line without a line break as added only", () => {
  const original = Text.of(["a", "b"]);
  const modified = Text.of(["a", "b", "c"]);
  const chunks = Chunk.build(original, modified);
  expect(diffStats({ chunks, original, modified })).toEqual({
    changed: 1,
    added: 1,
    removed: 0
  });
});

it("counts only the lines added around an unchanged line inside one chunk", () => {
  const original = Text.of(["word"]);
  const modified = Text.of(["", "word", ""]);
  const chunks = Chunk.build(original, modified);
  expect(diffStats({ chunks, original, modified })).toEqual({
    changed: 2,
    added: 2,
    removed: 0
  });
});

it("reports no change for identical text and no count for an imprecise diff", () => {
  const same = Text.of(["a", "b"]);
  expect(
    diffStats({
      chunks: Chunk.build(same, same),
      original: same,
      modified: same
    })
  ).toEqual({ changed: 0, added: 0, removed: 0 });
  const original = Text.of(["a"]);
  const modified = Text.of(["b"]);
  // What Chunk.build returns when a large diff times out and falls back.
  const chunks = [new Chunk([], 0, 2, 0, 2, false)];
  expect(diffStats({ chunks, original, modified })).toBeUndefined();
});

it("keeps line counts for a rewrite of several lines", () => {
  const lines = Array.from(
    { length: 150 },
    (_, n) => `line ${n} ${"word ".repeat(6)}`
  );
  const original = Text.of(lines);
  const modified = Text.of(
    lines.map((line, n) => (n < 10 ? line.toUpperCase() : line))
  );
  // The merge view's own default gives up on this edit and loses the counts.
  const mergeViewDefault = Chunk.build(original, modified, { scanLimit: 500 });
  expect(
    diffStats({ chunks: mergeViewDefault, original, modified })
  ).toBeUndefined();
  const chunks = Chunk.build(original, modified, diffConfig);
  expect(diffStats({ chunks, original, modified })).toEqual({
    changed: 10,
    added: 10,
    removed: 10
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
