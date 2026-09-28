import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { ResolvedEntry } from "@agent-mapper/core";
import { readClaudeUsage } from "./usage-reader";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function skill(
  name: string,
  options: { pluginId?: string } = {}
): ResolvedEntry {
  return {
    entry: {
      id: `${name}-${options.pluginId ?? "local"}`,
      tool: "claude",
      kind: "skill",
      name,
      path: `/project/.claude/skills/${name}/SKILL.md`,
      scope: "project",
      readState: "readable",
      isSymlink: false,
      pluginId: options.pluginId
    },
    resolution: {
      availability: "expected",
      loading: "agent-selected",
      reason: "Fixture"
    }
  };
}

function row(options: {
  cwd: string;
  session: string;
  time: string;
  skill?: string;
  id?: string;
}): string {
  return JSON.stringify({
    type: options.skill ? "assistant" : "user",
    cwd: options.cwd,
    sessionId: options.session,
    timestamp: options.time,
    message: options.skill
      ? {
          content: [
            {
              type: "tool_use",
              id: options.id,
              name: "Skill",
              input: { skill: options.skill, args: "private input" }
            }
          ]
        }
      : { content: "private message" }
  });
}

it("counts project skill invocations once and keeps ambiguous calls unattributed", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-usage-"));
  roots.push(home);
  const project = join(home, "project");
  const logs = join(home, ".claude", "projects", "encoded");
  mkdirSync(logs, { recursive: true });
  const at = "2026-09-20T10:00:00.000Z";
  const later = "2026-09-21T10:00:00.000Z";
  const first = { cwd: project, session: "one", time: at };
  writeFileSync(
    join(logs, "session.jsonl"),
    [
      row({ ...first, skill: "review", id: "call-1" }),
      row({ ...first, skill: "review", id: "call-1" }),
      row({ cwd: join(project, "sub"), session: "two", time: later }),
      row({
        cwd: project,
        session: "two",
        time: later,
        skill: "plugin:build",
        id: "call-2"
      }),
      row({
        cwd: `${project}-other`,
        session: "outside",
        time: later,
        skill: "review",
        id: "call-3"
      })
    ].join("\n")
  );
  const result = await readClaudeUsage({
    home,
    projectDirectory: project,
    items: [
      skill("review"),
      skill("idle"),
      skill("plugin:build", { pluginId: "plugin" })
    ]
  });
  expect(result.coverage).toEqual({ sessions: 2, from: at, to: later });
  expect(result.records).toMatchObject([
    { state: "recorded", count: 1, lastRecorded: at },
    { state: "none", count: 0 },
    { state: "uncovered", count: 0 }
  ]);
  expect(result.unattributedInvocations).toBe(1);
  expect(JSON.stringify(result)).not.toContain("private");
});

it("does not claim non-use when a log is malformed or no sessions are covered", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-usage-"));
  roots.push(home);
  const project = join(home, "project");
  const logs = join(home, ".claude", "projects");
  mkdirSync(logs, { recursive: true });
  const items = [skill("idle")];
  expect(
    (await readClaudeUsage({ home, projectDirectory: project, items }))
      .records[0]?.state
  ).toBe("uncovered");
  writeFileSync(
    join(logs, "session.jsonl"),
    `${row({ cwd: project, session: "one", time: "2026-09-20T10:00:00.000Z" })}\n{bad json`
  );
  const result = await readClaudeUsage({
    home,
    projectDirectory: project,
    items
  });
  expect(result.coverage.sessions).toBe(1);
  expect(result.records[0]?.state).toBe("uncovered");
  expect(result.notes.join(" ")).toContain("could not be read");
});

it("leaves duplicate current skill names unattributed", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-usage-"));
  roots.push(home);
  const project = join(home, "project");
  const logs = join(home, ".claude", "projects");
  mkdirSync(logs, { recursive: true });
  writeFileSync(
    join(logs, "session.jsonl"),
    row({
      cwd: project,
      session: "one",
      time: "2026-09-20T10:00:00.000Z",
      skill: "review",
      id: "call-1"
    })
  );
  const result = await readClaudeUsage({
    home,
    projectDirectory: project,
    items: [skill("review"), skill("review", { pluginId: "plugin" })]
  });
  expect(result.records.map((record) => record.state)).toEqual([
    "uncovered",
    "uncovered"
  ]);
  expect(result.unattributedInvocations).toBe(1);
});
