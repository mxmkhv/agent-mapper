import { linkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceDocument } from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import {
  documentFixture,
  removeFixture,
  startDocumentServer,
  type DocumentFixture
} from "./source-document-test-kit";

const fixtures: DocumentFixture[] = [];
const servers: { close(): Promise<void> }[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.close();
  }
  for (const fixture of fixtures.splice(0)) {
    removeFixture(fixture);
  }
});

async function setup() {
  const fixture = documentFixture();
  fixtures.push(fixture);
  const server = await startDocumentServer(fixture);
  servers.push(server);
  return { fixture, server };
}

it("opens a global instruction with exact content and provenance", async () => {
  const { fixture, server } = await setup();
  const { status, body } = await server.open(".claude/CLAUDE.md");
  expect(status).toBe(200);
  expect(body.content).toBe("# Global\n\nBe brief.\n");
  expect(body.canonicalPath).toBe(join(fixture.home, ".claude/CLAUDE.md"));
  expect(body.editable).toBe(true);
  expect(body.source).toMatchObject({ tool: "claude", scope: "global" });
  expect(body.lineEnding).toBe("lf");
  expect(body.historyDirectory.startsWith(fixture.history)).toBe(true);
});

it("gives a Codex link to a Claude file the same source key and shared impact", async () => {
  const { server } = await setup();
  const claude = (await server.open(".claude/CLAUDE.md")).body;
  const codex = (await server.open(".codex/AGENTS.md")).body;
  expect(codex.sourceKey).toBe(claude.sourceKey);
  expect(codex.documentId).not.toBe(claude.documentId);
  expect(codex.source.tool).toBe("codex");
  expect(codex.impact.coverage).toBe("scanned-contexts-only");
  expect(codex.impact.aliases).toHaveLength(2);
});

it("resolves skills under a symlinked folder to their real file", async () => {
  const { fixture, server } = await setup();
  const { body } = await server.open("writer/SKILL.md");
  expect(body.canonicalPath).toBe(
    join(fixture.home, "shared/skills/writer/SKILL.md")
  );
  expect(body.editable).toBe(true);
  expect(body.diagnostics).toEqual([]);
});

it("keeps plugin and managed files read-only", async () => {
  const { server } = await setup();
  const plugin = (await server.open("review/SKILL.md")).body;
  expect(plugin.editable).toBe(false);
  expect(plugin.readOnlyReason).toMatch(/plugin/i);
  const managed = (await server.open("managed/CLAUDE.md")).body;
  expect(managed.editable).toBe(false);
  expect(managed.readOnlyReason).toMatch(/managed/i);
});

it("keeps a project link into a plugin folder read-only", async () => {
  const { fixture, server } = await setup();
  symlinkSync(
    join(
      fixture.home,
      ".claude/plugins/cache/market/reviewer/1.0.0/skills/review/SKILL.md"
    ),
    join(fixture.project, "CLAUDE.local.md")
  );
  const { body } = await server.open("app/CLAUDE.local.md", {
    scope: "project",
    path: fixture.project
  });
  expect(body.editable).toBe(false);
  expect(body.readOnlyReason).toMatch(/plugin or managed folder/);
});

it("rejects forged document requests and unknown entries", async () => {
  const { fixture, server } = await setup();
  await server.scan();
  const unknown = await server.post("open", {
    scope: "global",
    workingDirectory: fixture.home,
    entryId: "not-an-entry"
  });
  expect(unknown.status).toBe(404);
  expect(unknown.body.error?.code).toBe("unknown_source");
  const unscanned = await server.post("open", {
    scope: "project",
    workingDirectory: "/etc",
    entryId: "x"
  });
  expect(unscanned.body.error?.code).toBe("unknown_source");
  const forged = await server.post("history", { documentId: "forged" });
  expect(forged.status).toBe(404);
  const malformed = await server.post("open", { scope: "everywhere" });
  expect(malformed.status).toBe(400);
});

it("requires the session token and same origin", async () => {
  const { server } = await setup();
  const anonymous = await fetch(`${server.base}/api/source-document/open`, {
    method: "POST",
    body: "{}"
  });
  expect(anonymous.status).toBe(401);
  const crossOrigin = await fetch(`${server.base}/api/source-document/open`, {
    method: "POST",
    headers: { ...server.headers, origin: "http://evil.test" },
    body: "{}"
  });
  expect(crossOrigin.status).toBe(403);
});

it("reports invalid encoding, oversized and missing files with typed errors", async () => {
  const { fixture, server } = await setup();
  const path = join(fixture.project, "CLAUDE.md");
  const context = { scope: "project" as const, path: fixture.project };
  writeFileSync(path, Buffer.from([0xff, 0xfe, 0x00]));
  expect((await server.open("app/CLAUDE.md", context)).body.error?.code).toBe(
    "invalid_encoding"
  );
  writeFileSync(path, "x".repeat(1_048_577));
  const large = await server.open("app/CLAUDE.md", context);
  expect(large.status).toBe(413);
  const snapshot = await server.scan(fixture.project);
  const entry = snapshot.items.find(({ entry }) => entry.path === path)!.entry;
  rmSync(path);
  const missing = await server.post("open", {
    scope: "project",
    workingDirectory: fixture.project,
    entryId: entry.id
  });
  expect(missing.status).toBe(404);
  expect(missing.body.error?.code).toBe("not_found");
});

it("opens empty, BOM, CRLF and malformed files as documents", async () => {
  const { fixture, server } = await setup();
  const context = { scope: "project" as const, path: fixture.project };
  writeFileSync(join(fixture.project, "CLAUDE.md"), "");
  const empty = (await server.open("app/CLAUDE.md", context)).body;
  expect(empty.content).toBe("");
  expect(empty.lineEnding).toBe("none");
  writeFileSync(join(fixture.project, "CLAUDE.md"), "﻿# Title\r\nLine\r\n");
  const crlf = (await server.open("app/CLAUDE.md", context)).body;
  expect(crlf).toMatchObject({
    content: "# Title\nLine\n",
    encoding: { bom: true },
    lineEnding: "crlf",
    editable: true
  });
  writeFileSync(join(fixture.project, "CLAUDE.md"), "a\r\nb\nc");
  const mixed = (await server.open("app/CLAUDE.md", context)).body;
  expect(mixed.editable).toBe(false);
  expect(mixed.readOnlyReason).toMatch(/line endings/);
  writeFileSync(
    join(fixture.home, "shared/skills/writer/SKILL.md"),
    "---\nname: [unclosed\n---\n"
  );
  const skill: SourceDocument = (await server.open("writer/SKILL.md")).body;
  expect(skill.diagnostics.some((item) => item.severity === "error")).toBe(
    true
  );
  expect(JSON.stringify(skill.diagnostics)).not.toContain("unclosed");
});

it("keeps hard-linked files read-only", async () => {
  const { fixture, server } = await setup();
  linkSync(
    join(fixture.project, "CLAUDE.md"),
    join(fixture.home, "hard-link.md")
  );
  const { body } = await server.open("app/CLAUDE.md", {
    scope: "project",
    path: fixture.project
  });
  expect(body.editable).toBe(false);
  expect(body.readOnlyReason).toMatch(/hard links/);
});

it("keeps file content out of inventory responses", async () => {
  const { fixture, server } = await setup();
  const snapshot = await server.scan(fixture.project);
  expect(JSON.stringify(snapshot)).not.toContain("Use bun.");
});
