import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type {
  AgentRecord,
  InventorySnapshot,
  PluginRecord,
  ResolvedEntry,
  ToolId
} from "@agent-mapper/core";
import { Workspace } from "./workspace";

function skill(tool: ToolId): ResolvedEntry {
  return {
    entry: {
      id: `${tool}-skill`,
      tool,
      kind: "skill",
      name: `${tool} skill`,
      path: `/app/${tool}/SKILL.md`,
      scope: "project",
      readState: "readable",
      isSymlink: false
    },
    resolution: {
      availability: "expected",
      loading: "agent-selected",
      reason: "Fixture"
    }
  };
}

function agent(tool: ToolId): AgentRecord {
  return {
    id: `${tool}-agent`,
    tool,
    name: `${tool} agent`,
    scope: "project",
    format: "markdown",
    sourcePath: `/app/${tool}/agent.md`,
    locator: "agent",
    descriptionPresent: true,
    readState: "readable",
    availability: "configured",
    reason: "Fixture"
  };
}

function plugin(tool: ToolId): PluginRecord {
  return {
    id: `${tool}-plugin`,
    tool,
    key: `${tool}-plugin`,
    name: `${tool} plugin`,
    scope: "project",
    state: "selected",
    reason: "Fixture",
    sourcePath: `/app/${tool}/plugin.json`,
    contributions: []
  };
}

const snapshot: InventorySnapshot = {
  workingDirectory: "/app",
  scannedAt: "2026-01-01T00:00:00.000Z",
  roots: { claude: "/home/.claude", codex: "/home/.codex" },
  items: [skill("claude"), skill("codex")],
  plugins: [plugin("claude"), plugin("codex")],
  hooks: [],
  mcpServers: [],
  memories: [],
  agents: [agent("claude"), agent("codex")],
  context: {
    claude: {
      startup: 0,
      skillMetadata: 0,
      onDemand: 0,
      unaccountedSources: 0
    },
    codex: { startup: 0, skillMetadata: 0, onDemand: 0, unaccountedSources: 0 }
  },
  findings: [],
  worktrees: [],
  coverage: []
};

it.each(["claude", "codex"] as const)(
  "shows %s counts that match the filtered lists",
  (tool) => {
    const html = renderToStaticMarkup(
      createElement(Workspace, {
        snapshot,
        globalView: false,
        initialTool: tool,
        initialTab: "skill",
        onRescan: () => undefined,
        onSelectPath: () => undefined
      })
    );
    expect(html).toContain("Skills <span>1</span>");
    expect(html).toContain("Agents <span>1</span>");
    expect(html).toContain("Plugins <span>1</span>");
    expect(html).toContain("1 sources");
    expect(html).toContain("1 agents");
    expect(html).toContain("1 plugins");
    expect(html).toContain(`${tool} skill`);
    expect(html).not.toContain(
      `${tool === "claude" ? "codex" : "claude"} skill`
    );
  }
);
