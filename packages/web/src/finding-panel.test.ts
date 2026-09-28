import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Finding } from "@agent-mapper/core";
import { FindingPanel } from "./finding-panel";

const findings: Finding[] = [
  {
    id: "repeat",
    tool: "claude",
    code: "repeated-instruction",
    level: "review",
    title: "Repeated instruction paragraphs",
    reason: "Two expected startup sources share a paragraph.",
    sources: [
      { id: "root", path: "/app/CLAUDE.md" },
      { id: "nested", path: "/app/src/CLAUDE.md" }
    ]
  },
  {
    id: "missing",
    tool: "codex",
    code: "missing-plugin",
    level: "problem",
    title: "Configured plugin is missing",
    reason: "Check the installation.",
    sources: [{ id: "plugin", path: "/app/.codex/config.toml" }]
  }
];

it("shows finding level, explanation, and both source links", () => {
  const html = renderToStaticMarkup(
    createElement(FindingPanel, {
      findings,
      tool: "claude",
      onOpenSource: () => undefined
    })
  );
  expect(html).toContain("Repeated instruction paragraphs");
  expect(html).toContain("review");
  expect(html).toContain("/app/CLAUDE.md");
  expect(html).toContain("/app/src/CLAUDE.md");
  expect(html.match(/View source/g)).toHaveLength(2);
  expect(html).not.toContain("Configured plugin is missing");
});

it("gives an explicit empty state for a tool without findings", () => {
  const html = renderToStaticMarkup(
    createElement(FindingPanel, {
      findings: findings.slice(0, 1),
      tool: "codex",
      onOpenSource: () => undefined
    })
  );
  expect(html).toContain("No findings in this view");
});
