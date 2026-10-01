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
  const replace = {
    originalStartLineNumber: 4,
    originalEndLineNumber: 5,
    modifiedStartLineNumber: 4,
    modifiedEndLineNumber: 6
  };
  const insert = {
    originalStartLineNumber: 9,
    originalEndLineNumber: 0,
    modifiedStartLineNumber: 11,
    modifiedEndLineNumber: 11
  };
  const remove = {
    originalStartLineNumber: 20,
    originalEndLineNumber: 21,
    modifiedStartLineNumber: 21,
    modifiedEndLineNumber: 0
  };
  expect(diffStats([replace, insert, remove])).toEqual({
    changed: 6,
    added: 4,
    removed: 4
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
