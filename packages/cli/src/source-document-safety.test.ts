import {
  chmodSync,
  linkSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import type {
  MutationResult,
  RevisionHistory,
  SourceDocument
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
  const project = { scope: "project" as const, path: fixture.project };
  return { fixture, server, project };
}

const saveBody = (document: SourceDocument, content: string) => ({
  documentId: document.documentId,
  sourceKey: document.sourceKey,
  expectedVersion: document.version,
  content
});

const pluginSkill =
  ".claude/plugins/cache/market/reviewer/1.0.0/skills/review/SKILL.md";

it("rejects writes through read-only targets and aliases", async () => {
  const { fixture, server, project } = await setup();
  symlinkSync(
    join(fixture.home, pluginSkill),
    join(fixture.project, "CLAUDE.local.md")
  );
  const alias = (await server.open("app/CLAUDE.local.md", project)).body;
  const managed = (await server.open("managed/CLAUDE.md")).body;
  linkSync(join(fixture.project, "AGENTS.md"), join(fixture.home, "hard.md"));
  const hardLinked = (await server.open("app/AGENTS.md", project)).body;
  for (const document of [alias, managed, hardLinked]) {
    const reply = await server.post("save", saveBody(document, "x\n"));
    expect(reply.status).toBe(403);
    expect(reply.body.error?.code).toBe("read_only");
  }
  expect(readFileSync(join(fixture.home, pluginSkill), "utf8")).toContain(
    "name: review"
  );
  expect(readFileSync(join(fixture.home, "managed/CLAUDE.md"), "utf8")).toBe(
    "# Managed\n"
  );
});

it("releases the lock after a failed save", async () => {
  const { fixture, server } = await setup();
  const document = (await server.open("writer/SKILL.md")).body;
  const invalid = await server.post(
    "save",
    saveBody(document, "---\nname: [broken\n---\n")
  );
  expect(invalid.status).toBe(422);
  writeFileSync(join(fixture.home, "shared/skills/writer/SKILL.md"), "moved\n");
  const stale = await server.post("save", saveBody(document, "mine\n"));
  expect(stale.status).toBe(409);
  const fresh = (await server.open("writer/SKILL.md")).body;
  const saved = await server.post<MutationResult>(
    "save",
    saveBody(fresh, "---\nname: writer\ndescription: Docs\n---\n")
  );
  expect(saved.body.outcome).toBe("saved");
  expect(readdirSync(join(fixture.history, fresh.sourceKey))).not.toContain(
    "lock"
  );
});

it("tells the losing concurrent save it is busy without asking to delete a live lock", async () => {
  const { server } = await setup();
  const claude = (await server.open(".claude/CLAUDE.md")).body;
  const codex = (await server.open(".codex/AGENTS.md")).body;
  const replies = await Promise.all([
    server.post("save", saveBody(claude, "claude\n")),
    server.post("save", saveBody(codex, "codex\n"))
  ]);
  const loser = replies.find((reply) => reply.status === 409);
  // Busy while the first write runs, or a conflict once it has finished; never a stale-lock prompt.
  expect(["busy", "conflict"]).toContain(loser?.body.error?.code);
  expect(loser?.body.error?.message).not.toMatch(/delete/i);
});

it("guards restore like save: stale, read-only and identical bytes", async () => {
  const { fixture, server, project } = await setup();
  const path = join(fixture.project, "CLAUDE.md");
  const opened = (await server.open("app/CLAUDE.md", project)).body;
  await server.post("save", saveBody(opened, "second\n"));
  const current = (await server.open("app/CLAUDE.md", project)).body;
  const history = await server.post<RevisionHistory>("history", {
    documentId: current.documentId
  });
  const revisionId = history.body.revisions[0]!.revisionId;
  const restore = (document: SourceDocument) =>
    server.post<MutationResult>("restore", {
      documentId: document.documentId,
      sourceKey: document.sourceKey,
      expectedVersion: document.version,
      revisionId
    });
  writeFileSync(path, "external\n");
  expect((await restore(current)).status).toBe(409);
  expect(readFileSync(path, "utf8")).toBe("external\n");
  writeFileSync(path, "# App\n\nUse bun.\n");
  const same = (await server.open("app/CLAUDE.md", project)).body;
  expect((await restore(same)).body.outcome).toBe("unchanged");
  chmodSync(path, 0o444);
  const locked = (await server.open("app/CLAUDE.md", project)).body;
  const readOnly = await restore(locked);
  chmodSync(path, 0o644);
  expect(readOnly.status).toBe(process.getuid?.() === 0 ? 200 : 403);
});

it("validates CRLF frontmatter the way it will be saved", async () => {
  const { fixture, server } = await setup();
  const document = (await server.open("writer/SKILL.md")).body;
  const reply = await server.post(
    "save",
    saveBody(document, "---\r\nname: [broken\r\n---\r\n")
  );
  expect(reply.status).toBe(422);
  expect(
    readFileSync(join(fixture.home, "shared/skills/writer/SKILL.md"), "utf8")
  ).toContain("name: writer");
});

it("measures the size limit on the bytes that would be written", async () => {
  const { fixture, server, project } = await setup();
  const path = join(fixture.project, "CLAUDE.md");
  writeFileSync(path, "a\r\nb\r\n");
  const document = (await server.open("app/CLAUDE.md", project)).body;
  // Under 1 MiB as LF text, over it once each newline becomes CRLF.
  const content = "x\n".repeat(400_000);
  const reply = await server.post("save", saveBody(document, content));
  expect(reply.status).toBe(413);
  expect(readFileSync(path, "utf8")).toBe("a\r\nb\r\n");
});

it("opens skills whose frontmatter uses YAML aliases", async () => {
  const { fixture, server } = await setup();
  writeFileSync(
    join(fixture.home, "shared/skills/writer/SKILL.md"),
    "---\nname: &n writer\ndescription: *n\n---\n"
  );
  const reply = await server.open("writer/SKILL.md");
  expect(reply.status).toBe(200);
  expect(reply.body.diagnostics.map((item) => item.code)).toEqual([
    "skill-description-alias"
  ]);
});

it("lists readable history around a damaged snapshot and an unreadable file", async () => {
  const { fixture, server, project } = await setup();
  const opened = (await server.open("app/CLAUDE.md", project)).body;
  await server.post("save", saveBody(opened, "second\n"));
  const folder = join(fixture.history, opened.sourceKey);
  writeFileSync(join(folder, `${"a".repeat(24)}.json`), "{not json");
  writeFileSync(join(fixture.project, "CLAUDE.md"), "x".repeat(1_048_577));
  const history = await server.post<RevisionHistory>("history", {
    documentId: opened.documentId
  });
  expect(history.status).toBe(200);
  expect(history.body.revisions).toHaveLength(1);
  expect(history.body.problems).toHaveLength(2);
  expect(history.body.problems.join(" ")).toMatch(/damaged/);
  expect(history.body.problems.join(" ")).toMatch(/larger than 1 MiB/);
});

it("refuses requests for a source that left the scan or a mismatched file", async () => {
  const { fixture, server, project } = await setup();
  const document = (await server.open("app/AGENTS.md", project)).body;
  const mismatched = await server.post("save", {
    ...saveBody(document, "x\n"),
    sourceKey: "0".repeat(64)
  });
  expect(mismatched.status).toBe(400);
  rmSync(join(fixture.project, "AGENTS.md"));
  await server.scan(fixture.project);
  const gone = await server.post("save", saveBody(document, "x\n"));
  expect(gone.status).toBe(404);
  expect(gone.body.error?.code).toBe("unknown_source");
});

it("refuses to save text the reader could not open again", async () => {
  const { fixture, server, project } = await setup();
  const document = (await server.open("app/CLAUDE.md", project)).body;
  const review = await server.post(
    "validate",
    saveBody(document, "new\0text\n")
  );
  expect(review.body.error?.code).toBe("invalid_encoding");
  const reply = await server.post("save", saveBody(document, "new\0text\n"));
  expect(reply.status).toBe(422);
  expect(reply.body.error?.code).toBe("invalid_encoding");
  expect(readFileSync(join(fixture.project, "CLAUDE.md"), "utf8")).toBe(
    "# App\n\nUse bun.\n"
  );
  const reopened = await server.open("app/CLAUDE.md", project);
  expect(reopened.status).toBe(200);
});
