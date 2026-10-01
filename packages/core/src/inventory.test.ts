import { expect, it } from "vitest";
import { resolveInventory, type InventoryEntry } from "./inventory";

const entry = (overrides: Partial<InventoryEntry>): InventoryEntry => ({
  id: "one",
  tool: "codex",
  kind: "instruction",
  name: "AGENTS.md",
  path: "/work/AGENTS.md",
  scope: "project",
  readState: "readable",
  isSymlink: false,
  ...overrides
});

it("applies ancestor instructions and excludes sibling projects", () => {
  const results = resolveInventory(
    [
      entry({ id: "parent", path: "/work/AGENTS.md" }),
      entry({ id: "nested", path: "/work/app/AGENTS.md" }),
      entry({ id: "sibling", path: "/work/other/AGENTS.md" })
    ],
    { workingDirectory: "/work/app/src", tool: "codex" }
  );

  expect(
    results.map(({ entry: item, resolution }) => [
      item.id,
      resolution.availability
    ])
  ).toEqual([
    ["parent", "expected"],
    ["nested", "expected"],
    ["sibling", "not-applicable"]
  ]);
});

it("keeps unknown loading visible when a source cannot be read", () => {
  const [result] = resolveInventory([entry({ readState: "unreadable" })], {
    workingDirectory: "/work",
    tool: "codex"
  });
  expect(result?.resolution).toMatchObject({
    availability: "unknown",
    loading: "unknown"
  });
  expect(result?.resolution.reason).toContain("unreadable");
});

it("keeps skills available on demand without counting their bodies as startup", () => {
  const [result] = resolveInventory(
    [
      entry({
        kind: "skill",
        path: "/work/.agents/skills/review/SKILL.md",
        projectPath: "/work",
        name: "review",
        characters: 800
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(result?.resolution).toMatchObject({
    availability: "expected",
    loading: "agent-selected",
    estimatedTokens: { startup: 0, onDemand: 200 }
  });
});

it("does not claim a skill with malformed frontmatter loads", () => {
  const [result] = resolveInventory(
    [
      entry({
        kind: "skill",
        name: "writer",
        path: "/work/.agents/skills/writer/SKILL.md",
        projectPath: "/work",
        error: "Frontmatter repeats a key. Keep one of them."
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(result?.resolution).toMatchObject({
    availability: "unknown",
    loading: "unknown"
  });
  expect(result?.resolution.reason).toContain("Frontmatter repeats a key.");
});

it("shows Codex's same-folder override as the winner", () => {
  const results = resolveInventory(
    [
      entry({ id: "normal", characters: 12 }),
      entry({
        id: "override",
        name: "AGENTS.override.md",
        path: "/work/AGENTS.override.md",
        characters: 20
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(
    results.map((result) => [result.entry.id, result.resolution.availability])
  ).toEqual([
    ["normal", "shadowed"],
    ["override", "expected"]
  ]);
  expect(results[0]?.resolution.reason).toContain("AGENTS.override.md");
});

it("skips empty Codex instruction files without letting an empty override win", () => {
  const results = resolveInventory(
    [
      entry({ id: "normal", characters: 20 }),
      entry({
        id: "override",
        name: "AGENTS.override.md",
        path: "/work/AGENTS.override.md",
        characters: 0
      })
    ],
    { workingDirectory: "/work", tool: "codex" }
  );
  expect(results.map(({ resolution }) => resolution.availability)).toEqual([
    "expected",
    "not-applicable"
  ]);
});

it("uses Claude's project AGENTS fallback only without a project CLAUDE file", () => {
  const agent = entry({ id: "claude-agent", tool: "claude", characters: 20 });
  const claude = entry({
    id: "claude-md",
    tool: "claude",
    name: "CLAUDE.md",
    path: "/work/CLAUDE.md",
    characters: 20
  });
  expect(
    resolveInventory([agent], { workingDirectory: "/work", tool: "claude" })[0]
      ?.resolution.availability
  ).toBe("expected");
  expect(
    resolveInventory([agent, claude], {
      workingDirectory: "/work",
      tool: "claude"
    })[0]?.resolution.availability
  ).toBe("shadowed");
});

// The scanner gives .claude/CLAUDE.md its project folder, as instruction-sources.ts does.
const claudeAt = (path: string, name = "CLAUDE.md") =>
  entry({
    id: path,
    tool: "claude",
    name,
    path,
    characters: 40,
    projectPath: path.includes("/.claude/")
      ? path.slice(0, path.indexOf("/.claude/"))
      : undefined
  });
const agentsAt = (path: string) =>
  entry({ id: path, tool: "claude", path, characters: 80 });
const availability = (entries: InventoryEntry[]) =>
  resolveInventory(entries, {
    workingDirectory: "/work/app",
    tool: "claude"
  }).map(({ entry: item, resolution }) => [item.id, resolution.availability]);

it("drops every Claude AGENTS file when any project CLAUDE file is in the folder chain", () => {
  expect(
    availability([claudeAt("/work/CLAUDE.md"), agentsAt("/work/app/AGENTS.md")])
  ).toEqual([
    ["/work/CLAUDE.md", "expected"],
    ["/work/app/AGENTS.md", "shadowed"]
  ]);
  expect(
    availability([agentsAt("/work/AGENTS.md"), claudeAt("/work/app/CLAUDE.md")])
  ).toEqual([
    ["/work/AGENTS.md", "shadowed"],
    ["/work/app/CLAUDE.md", "expected"]
  ]);
  expect(
    availability([
      agentsAt("/work/AGENTS.md"),
      claudeAt("/work/app/CLAUDE.local.md", "CLAUDE.local.md")
    ])
  ).toEqual([
    ["/work/AGENTS.md", "shadowed"],
    ["/work/app/CLAUDE.local.md", "expected"]
  ]);
  expect(
    availability([
      agentsAt("/work/AGENTS.md"),
      claudeAt("/work/app/.claude/CLAUDE.md")
    ])
  ).toEqual([
    ["/work/AGENTS.md", "shadowed"],
    ["/work/app/.claude/CLAUDE.md", "expected"]
  ]);
  expect(
    availability([agentsAt("/work/AGENTS.md"), agentsAt("/work/app/AGENTS.md")])
  ).toEqual([
    ["/work/AGENTS.md", "expected"],
    ["/work/app/AGENTS.md", "expected"]
  ]);
});

it("keeps Claude AGENTS files when the only CLAUDE file is global or outside the chain", () => {
  // The working folder sits under home, so only the scope keeps ~/.claude/CLAUDE.md from counting.
  const results = resolveInventory(
    [
      entry({
        id: "global",
        tool: "claude",
        scope: "global",
        name: "CLAUDE.md",
        path: "/home/.claude/CLAUDE.md",
        characters: 40
      }),
      entry({
        id: "sibling",
        tool: "claude",
        name: "CLAUDE.md",
        path: "/home/other/CLAUDE.md",
        characters: 40
      }),
      entry({
        id: "agents",
        tool: "claude",
        path: "/home/app/AGENTS.md",
        characters: 80
      })
    ],
    { workingDirectory: "/home/app", tool: "claude" }
  );
  expect(results[2]?.resolution.availability).toBe("expected");
  expect(results[2]?.resolution.estimatedTokens?.startup).toBe(20);
});
