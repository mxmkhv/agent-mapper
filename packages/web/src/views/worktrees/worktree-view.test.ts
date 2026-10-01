import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { WorktreeComparison, WorktreeRecord } from "@agent-mapper/core";
import { WorktreeView } from "./worktree-view";

const worktrees: WorktreeRecord[] = [
  { path: "/app", isMain: true, state: "available", branch: "main" },
  { path: "/linked", isMain: false, state: "available", branch: "feature" },
  { path: "/stale", isMain: false, state: "prunable" }
];

const comparison: WorktreeComparison = {
  mainPath: "/app",
  herePath: "/linked",
  differences: [
    {
      id: "changed",
      relativePath: "AGENTS.md",
      kind: "instruction",
      tool: "shared",
      state: "different-content",
      main: {
        id: "main",
        path: "/app/AGENTS.md",
        tracking: "tracked",
        readState: "readable"
      },
      here: {
        id: "here",
        path: "/linked/AGENTS.md",
        tracking: "tracked",
        readState: "readable"
      }
    },
    {
      id: "missing",
      relativePath: ".claude/settings.local.json",
      kind: "settings",
      tool: "claude",
      state: "only-main",
      main: {
        id: "local",
        path: "/app/.claude/settings.local.json",
        tracking: "not tracked",
        readState: "readable"
      }
    }
  ]
};

it("shows linked checkouts from the main view, including stale registrations", () => {
  const html = renderToStaticMarkup(
    createElement(WorktreeView, {
      worktrees,
      workingDirectory: "/app",
      context: {},
      tool: "claude",
      refreshKey: 0,
      onSelectPath: () => undefined,
      onRemoved: () => undefined
    })
  );
  expect(html).toContain("feature");
  expect(html).toContain("prunable");
  expect(html).toContain("linked");
  // Only available checkouts offer removal; a stale registration offers Prune instead.
  expect(html.match(/>Remove</g)).toHaveLength(1);
  expect(html.match(/>Prune</g)).toHaveLength(1);
});

it("explains when the selected folder is outside Git", () => {
  const html = renderToStaticMarkup(
    createElement(WorktreeView, {
      worktrees: [],
      workingDirectory: "/plain",
      context: {},
      tool: "claude",
      refreshKey: 0,
      onSelectPath: () => undefined,
      onRemoved: () => undefined
    })
  );
  expect(html).toContain("No Git repository");
});

it("lists content differences before files only in the main checkout", () => {
  const html = renderToStaticMarkup(
    createElement(WorktreeView, {
      worktrees,
      comparison,
      workingDirectory: "/linked",
      context: {},
      tool: "claude",
      refreshKey: 0,
      onSelectPath: () => undefined,
      onRemoved: () => undefined
    })
  );
  expect(html.indexOf("Different content")).toBeGreaterThan(-1);
  expect(html.indexOf("Different content")).toBeLessThan(
    html.indexOf("Only in main checkout")
  );
  expect(html).not.toContain("Private prompt");
});

it("keeps shared differences but hides Claude files under the Codex filter", () => {
  const comparison: WorktreeComparison = {
    mainPath: "/app",
    herePath: "/linked",
    differences: [
      {
        id: "shared",
        relativePath: "AGENTS.md",
        kind: "instruction",
        tool: "shared",
        state: "only-main"
      },
      {
        id: "claude",
        relativePath: ".claude/settings.json",
        kind: "settings",
        tool: "claude",
        state: "only-main"
      }
    ]
  };
  const html = renderToStaticMarkup(
    createElement(WorktreeView, {
      worktrees,
      comparison,
      workingDirectory: "/linked",
      context: {},
      tool: "codex",
      refreshKey: 0,
      onSelectPath: () => undefined,
      onRemoved: () => undefined
    })
  );
  expect(html).toContain("AGENTS.md");
  expect(html).not.toContain("settings.json");
});

it("shows checkout paths under home with ~", () => {
  const html = renderToStaticMarkup(
    createElement(WorktreeView, {
      worktrees: [
        { path: "/Users/me/app", isMain: true, state: "available" },
        {
          path: "/Users/me/trees/feature",
          isMain: false,
          state: "available",
          branch: "feat/x"
        }
      ],
      workingDirectory: "/Users/me/app",
      context: { home: "/Users/me" },
      tool: "claude",
      refreshKey: 0,
      onSelectPath: () => undefined,
      onRemoved: () => undefined
    })
  );
  expect(html).toContain('title="~/trees/feature"');
  expect(html).not.toContain("Users");
});
