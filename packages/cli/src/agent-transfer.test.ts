import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillTransferPlan, SourceDocument } from "@agent-mapper/core";
import { parse } from "smol-toml";
import { afterEach, expect, it } from "vitest";
import {
  cleanupSkillTransfers,
  setupSkillTransfer as setup,
  write
} from "./skill-transfer-test-kit";

afterEach(cleanupSkillTransfers);

const reviewer =
  "---\nname: reviewer\ndescription: Reviews code\ntools: Read\n---\n\nRead the diff.\n";

async function agentSetup() {
  const kit = await setup();
  write(join(kit.fixture.project, ".claude/agents/reviewer.md"), reviewer);
  const snapshot = await kit.client.scan(kit.fixture.project);
  const agent = snapshot.agents.find((item) => item.name === "reviewer");
  if (!agent) {
    throw new Error("Fixture agent was not scanned.");
  }
  const source = {
    scope: "project",
    workingDirectory: snapshot.workingDirectory,
    entryId: agent.id
  };
  return { ...kit, source };
}

it("copies an agent to another project, converting it for the other tool", async () => {
  const { other, client, source, transfer } = await agentSetup();
  const { plan, apply } = await transfer({
    source,
    mode: "copy",
    projectPath: other,
    tools: ["claude", "codex"]
  });
  expect(plan.blocked).toBeUndefined();
  expect(plan.warnings).toEqual([
    "Codex has no equivalent for these Claude Code settings, so the copy leaves them out: tools."
  ]);
  expect(apply.status).toBe(200);
  expect(readFileSync(join(other, ".claude/agents/reviewer.md"), "utf8")).toBe(
    reviewer
  );
  expect(
    parse(readFileSync(join(other, ".codex/agents/reviewer.toml"), "utf8"))
  ).toEqual({
    name: "reviewer",
    description: "Reviews code",
    developer_instructions: "Read the diff.\n"
  });
  // The reported IDs are the ones the next scan assigns.
  const ids = (await client.scan(other)).agents.map((agent) => agent.id);
  for (const created of apply.body.created) {
    expect(ids).toContain(created.entryId);
  }
});

it("never overwrites an agent and never moves one", async () => {
  const { other, source, transfer, post } = await agentSetup();
  const body = { source, mode: "copy", projectPath: other, tools: ["codex"] };
  write(join(other, ".codex/agents/reviewer.toml"), 'name = "mine"\n');
  const { plan, apply } = await transfer(body);
  expect(plan.destinations[0]?.conflict).toContain("already exists");
  expect(apply.status).toBe(409);
  expect(readFileSync(join(other, ".codex/agents/reviewer.toml"), "utf8")).toBe(
    'name = "mine"\n'
  );
  const move = await post("plan", { ...body, mode: "promote" });
  expect(move.body.error?.message).toBe(
    "Agents can be copied to a project, not moved to global."
  );
  expect(existsSync(join(other, ".claude/agents/reviewer.md"))).toBe(false);
});

it("stops an agent copy when the agent changed since the preview", async () => {
  const { fixture, other, source, post } = await agentSetup();
  const body = { source, mode: "copy", projectPath: other, tools: ["codex"] };
  const plan = await post<SkillTransferPlan>("plan", body);
  write(
    join(fixture.project, ".claude/agents/reviewer.md"),
    reviewer.replace("Read the diff.", "Read the PR.")
  );
  const apply = await post("apply", {
    ...body,
    fingerprint: plan.body.fingerprint
  });
  expect(apply.status).toBe(409);
  expect(existsSync(join(other, ".codex/agents/reviewer.toml"))).toBe(false);
});

it("writes nothing when the agent cannot be converted", async () => {
  const { fixture, other, client, transfer } = await agentSetup();
  write(join(fixture.project, ".claude/agents/broken.md"), "No frontmatter\n");
  const snapshot = await client.scan(fixture.project);
  const broken = snapshot.agents.find((agent) =>
    agent.sourcePath.endsWith("broken.md")
  );
  if (!broken) {
    throw new Error("Fixture agent was not scanned.");
  }
  const { plan, apply } = await transfer({
    source: {
      scope: "project",
      workingDirectory: snapshot.workingDirectory,
      entryId: broken.id
    },
    mode: "copy",
    projectPath: other,
    tools: ["codex"]
  });
  expect(plan.blocked).toContain("cannot be converted for Codex");
  expect(apply.status).toBe(400);
  expect(existsSync(join(other, ".codex/agents/broken.toml"))).toBe(false);
});

it("opens an agent as a document and blocks saving broken TOML", async () => {
  const { fixture, client } = await agentSetup();
  write(
    join(fixture.project, ".codex/agents/explorer.toml"),
    'name = "explorer"\ndescription = "Finds"\ndeveloper_instructions = "Look"\n'
  );
  const snapshot = await client.scan(fixture.project);
  const agent = snapshot.agents.find((item) => item.name === "explorer");
  if (!agent) {
    throw new Error("Fixture agent was not scanned.");
  }
  const opened = await client.post<SourceDocument>("open", {
    scope: "project",
    workingDirectory: snapshot.workingDirectory,
    entryId: agent.id
  });
  expect(opened.body.editable).toBe(true);
  expect(opened.body.source.kind).toBe("agent");
  const saved = await client.post("save", {
    documentId: opened.body.documentId,
    sourceKey: opened.body.sourceKey,
    expectedVersion: opened.body.version,
    content: "name = [\n"
  });
  expect(saved.status).toBe(422);
  expect(saved.body.error?.diagnostics?.[0]?.code).toBe("toml-syntax");
});
