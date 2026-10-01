import { expect, it } from "vitest";
import type { AgentRecord, InventorySnapshot } from "@agent-mapper/core";
import { buildRecords } from "./build-records";
import { canCopy, canDelete, canEdit } from "./copyable";

const repo = "/Users/dev/code/app";
const emptyContext = {
  startup: 0,
  skillMetadata: 0,
  onDemand: 0,
  unaccountedSources: 0
};

function agent(parts: Partial<AgentRecord>): AgentRecord {
  return {
    id: "reviewer",
    tool: "claude",
    name: "reviewer",
    scope: "project",
    format: "markdown",
    sourcePath: `${repo}/.claude/agents/reviewer.md`,
    locator: "frontmatter",
    descriptionPresent: true,
    readState: "readable",
    availability: "configured",
    reason: "Declared locally.",
    ...parts
  };
}

function records(agents: AgentRecord[]) {
  const snapshot: InventorySnapshot = {
    workingDirectory: repo,
    scannedAt: "2026-10-01T10:00:00.000Z",
    roots: { claude: "/Users/dev/.claude", codex: "/Users/dev/.codex" },
    items: [],
    imports: [],
    plugins: [],
    hooks: [],
    mcpServers: [],
    memories: [],
    agents,
    context: { claude: emptyContext, codex: emptyContext },
    findings: [],
    worktrees: [],
    coverage: []
  };
  return buildRecords(snapshot, "project");
}

it("lets a readable agent be edited, copied and deleted", () => {
  const [record] = records([agent({})]);
  expect(
    record && [canEdit(record), canCopy(record), canDelete(record)]
  ).toEqual([true, true, true]);
});

it("keeps a broken agent link deletable, though it cannot be edited or copied", () => {
  const [record] = records([
    agent({
      id: "ghost",
      sourcePath: `${repo}/.claude/agents/ghost.md`,
      realPath: "/Users/dev/gone/ghost.md",
      readState: "unreadable",
      availability: "unknown"
    })
  ]);
  expect(record?.sourceRef?.entryId).toBe("ghost");
  expect(record?.unreadable).toBe(true);
  expect(
    record && [canEdit(record), canCopy(record), canDelete(record)]
  ).toEqual([false, false, true]);
});
