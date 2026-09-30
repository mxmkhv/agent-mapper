import { expect, it } from "vitest";
import { diffStats } from "../documents/diff-stats";
import { sizeText } from "../inspector/inspector-sections";
import type { InventoryRecord } from "./record-types";
import { telltaleFolders } from "./same-names";

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

it("labels same-named copies with the nearest folder that differs", () => {
  const labels = telltaleFolders(
    [
      skill("agents", `${home}/.agents/skills/react-render-skill/SKILL.md`),
      skill("codex", `${home}/.codex/skills/react-render-skill/SKILL.md`)
    ],
    { home }
  );
  expect(Object.fromEntries(labels)).toEqual({
    agents: ".agents",
    codex: ".codex"
  });
});

it("falls back to the path when the differing folder name repeats", () => {
  const labels = telltaleFolders(
    [
      skill("home", `${home}/.claude/skills/x/SKILL.md`),
      skill("app", `${home}/app/.claude/skills/x/SKILL.md`),
      skill("codex", `${home}/.codex/skills/x/SKILL.md`)
    ],
    { home }
  );
  expect(new Set(labels.values()).size).toBe(3);
  expect(labels.get("home")).toBe("~/.claude");
  expect(labels.get("app")).toBe("~/app/.claude");
});

it("leaves unique names and identical paths unlabelled", () => {
  const path = `${home}/.codex/skills/x/SKILL.md`;
  expect(
    telltaleFolders([skill("a", path), skill("b", path)], { home }).size
  ).toBe(0);
});

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
