import {
  chmodSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import type {
  MutationResult,
  SourceDocument,
  ValidationResult
} from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import {
  documentFixture,
  removeFixture,
  startDocumentServer,
  type DocumentFixture
} from "./source-document-test-kit";

const fixtures: DocumentFixture[] = [];
const servers: { close(): Promise<void> }[] = [];
const cleanups: (() => void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
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

const saveBody = (document: SourceDocument, content: string) => ({
  documentId: document.documentId,
  sourceKey: document.sourceKey,
  expectedVersion: document.version,
  content
});

const snapshots = (fixture: DocumentFixture, document: SourceDocument) =>
  readdirSync(join(fixture.history, document.sourceKey)).filter((name) =>
    name.endsWith(".json")
  );

it("saves through a symlink without replacing the link", async () => {
  const { fixture, server } = await setup();
  const target = join(fixture.home, ".claude/CLAUDE.md");
  chmodSync(target, 0o640);
  const document = (await server.open(".codex/AGENTS.md")).body;
  const saved = await server.post<MutationResult>(
    "save",
    saveBody(document, "# Global\n\nBe precise.\n")
  );
  expect(saved.status).toBe(200);
  expect(saved.body.outcome).toBe("saved");
  expect(saved.body.document?.version).not.toBe(document.version);
  expect(readFileSync(target, "utf8")).toBe("# Global\n\nBe precise.\n");
  expect(
    lstatSync(join(fixture.home, ".codex/AGENTS.md")).isSymbolicLink()
  ).toBe(true);
  expect(statSync(target).mode & 0o777).toBe(0o640);
  expect(snapshots(fixture, document)).toHaveLength(1);
  expect(
    readdirSync(join(fixture.home, ".claude")).some((name) =>
      name.endsWith(".tmp")
    )
  ).toBe(false);
});

it("preserves BOM and CRLF line endings", async () => {
  const { fixture, server } = await setup();
  const path = join(fixture.project, "CLAUDE.md");
  writeFileSync(path, "﻿a\r\nb\r\n");
  const document = (
    await server.open("app/CLAUDE.md", {
      scope: "project",
      path: fixture.project
    })
  ).body;
  await server.post("save", saveBody(document, "a\nb\nc\n"));
  expect(readFileSync(path)).toEqual(Buffer.from("﻿a\r\nb\r\nc\r\n"));
});

it("refuses stale content without touching the file", async () => {
  const { fixture, server } = await setup();
  const path = join(fixture.home, ".claude/CLAUDE.md");
  const document = (await server.open(".claude/CLAUDE.md")).body;
  writeFileSync(path, "external edit\n");
  const stale = await server.post("save", saveBody(document, "mine\n"));
  expect(stale.status).toBe(409);
  expect(stale.body.error?.code).toBe("conflict");
  expect(readFileSync(path, "utf8")).toBe("external edit\n");
  const review = await server.post("validate", saveBody(document, "mine\n"));
  expect(review.status).toBe(409);
});

it("reconciles a retried save after a restart without a second write", async () => {
  const { fixture, server } = await setup();
  const original = (await server.open(".claude/CLAUDE.md")).body;
  const draft = "# Global\n\nRetried.\n";
  await server.post("save", saveBody(original, draft));
  await server.close();
  servers.splice(0);
  const restarted = await startDocumentServer(fixture);
  servers.push(restarted);
  const fresh = (await restarted.open(".claude/CLAUDE.md")).body;
  expect(fresh.sourceKey).toBe(original.sourceKey);
  const retry = await restarted.post<MutationResult>("save", {
    ...saveBody(original, draft),
    documentId: fresh.documentId
  });
  expect(retry.body.outcome).toBe("unchanged");
  expect(snapshots(fixture, original)).toHaveLength(1);
  const review = await restarted.post<ValidationResult>("validate", {
    ...saveBody(original, draft),
    documentId: fresh.documentId
  });
  expect(review.body.unchanged).toBe(true);
  const different = await restarted.post("save", {
    ...saveBody(original, "something else\n"),
    documentId: fresh.documentId
  });
  expect(different.status).toBe(409);
});

it("refuses to save after a link is retargeted", async () => {
  const { fixture, server } = await setup();
  const link = join(fixture.home, ".codex/AGENTS.md");
  const document = (await server.open(".codex/AGENTS.md")).body;
  const other = join(fixture.home, "other.md");
  writeFileSync(other, "# Global\n\nBe brief.\n");
  rmSync(link);
  symlinkSync(other, link);
  const reply = await server.post("save", saveBody(document, "changed\n"));
  expect(reply.status).toBe(409);
  expect(readFileSync(other, "utf8")).toBe("# Global\n\nBe brief.\n");
  expect(readFileSync(join(fixture.home, ".claude/CLAUDE.md"), "utf8")).toBe(
    "# Global\n\nBe brief.\n"
  );
});

it("rejects writes to plugin files and read-only folders", async () => {
  const { fixture, server } = await setup();
  const plugin = (await server.open("review/SKILL.md")).body;
  const pluginWrite = await server.post("save", saveBody(plugin, "x\n"));
  expect(pluginWrite.status).toBe(403);
  expect(pluginWrite.body.error?.code).toBe("read_only");
  chmodSync(fixture.project, 0o555);
  cleanups.push(() => chmodSync(fixture.project, 0o755));
  const context = { scope: "project" as const, path: fixture.project };
  const locked = (await server.open("app/CLAUDE.md", context)).body;
  expect(locked.editable).toBe(false);
  expect(locked.readOnlyReason).toMatch(/folder/);
  const write = await server.post("save", saveBody(locked, "x\n"));
  expect(write.status).toBe(403);
  expect(readFileSync(join(fixture.project, "CLAUDE.md"), "utf8")).toBe(
    "# App\n\nUse bun.\n"
  );
});

it("blocks invalid skill frontmatter with diagnostics", async () => {
  const { fixture, server } = await setup();
  const document = (await server.open("writer/SKILL.md")).body;
  const reply = await server.post(
    "save",
    saveBody(document, "---\nname: [broken\n---\n")
  );
  expect(reply.status).toBe(422);
  expect(reply.body.error?.diagnostics?.length).toBeGreaterThan(0);
  expect(
    readFileSync(join(fixture.home, "shared/skills/writer/SKILL.md"), "utf8")
  ).toContain("name: writer");
});

it("fails before writing when history cannot be stored", async () => {
  const { fixture, server } = await setup();
  writeFileSync(fixture.history, "not a folder");
  const document = (await server.open(".claude/CLAUDE.md")).body;
  const reply = await server.post("save", saveBody(document, "x\n"));
  expect(reply.status).toBe(500);
  expect(reply.body.error?.code).toBe("history_unavailable");
  expect(readFileSync(join(fixture.home, ".claude/CLAUDE.md"), "utf8")).toBe(
    "# Global\n\nBe brief.\n"
  );
});

it("reports a leftover lock as busy and never takes it over", async () => {
  const { fixture, server } = await setup();
  const document = (await server.open(".claude/CLAUDE.md")).body;
  await server.post("save", saveBody(document, "first\n"));
  const lock = join(fixture.history, document.sourceKey, "lock");
  writeFileSync(lock, "pid 1\ncreated 2000-01-01T00:00:00.000Z\ntoken x\n");
  const fresh = (await server.open(".claude/CLAUDE.md")).body;
  const reply = await server.post("save", saveBody(fresh, "second\n"));
  expect(reply.status).toBe(409);
  expect(reply.body.error?.code).toBe("busy");
  expect(reply.body.error?.message).toContain(lock);
  expect(readFileSync(lock, "utf8")).toContain("token x");
});

it("lets only one of two racing aliases write", async () => {
  const { fixture, server } = await setup();
  const claude = (await server.open(".claude/CLAUDE.md")).body;
  const codex = (await server.open(".codex/AGENTS.md")).body;
  const replies = await Promise.all([
    server.post<MutationResult>("save", saveBody(claude, "claude\n")),
    server.post<MutationResult>("save", saveBody(codex, "codex\n"))
  ]);
  const saved = replies.filter((reply) => reply.body.outcome === "saved");
  expect(saved).toHaveLength(1);
  expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409]);
  expect(["claude\n", "codex\n"]).toContain(
    readFileSync(join(fixture.home, ".claude/CLAUDE.md"), "utf8")
  );
});

it("serves fonts and the editor content security policy", async () => {
  const { fixture, server } = await setup();
  writeFileSync(join(fixture.home, "web", "codicon.ttf"), "font");
  const response = await fetch(`${server.base}/codicon.ttf`);
  expect(response.headers.get("content-type")).toBe("font/ttf");
  const policy = response.headers.get("content-security-policy") ?? "";
  expect(policy).toContain("worker-src 'self'");
  expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  expect(policy).toContain("script-src 'self';");
  expect(policy).not.toContain("unsafe-eval");
});
