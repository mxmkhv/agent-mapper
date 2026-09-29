import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  MutationResult,
  RevisionContent,
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
  return { fixture, server };
}

type Server = Awaited<ReturnType<typeof setup>>["server"];

async function save(
  server: Server,
  input: { document: SourceDocument; content: string }
): Promise<SourceDocument> {
  const reply = await server.post<MutationResult>("save", {
    documentId: input.document.documentId,
    sourceKey: input.document.sourceKey,
    expectedVersion: input.document.version,
    content: input.content
  });
  if (!reply.body.document) {
    throw new Error(`Save failed: ${reply.body.error?.message}`);
  }
  return reply.body.document;
}

it("restores exact prior bytes after a restart, and the restore is undoable", async () => {
  const { fixture, server } = await setup();
  const path = join(fixture.project, "CLAUDE.md");
  const context = { scope: "project" as const, path: fixture.project };
  writeFileSync(path, "﻿first\r\n");
  const opened = (await server.open("app/CLAUDE.md", context)).body;
  await save(server, { document: opened, content: "second\n" });
  await server.close();
  servers.splice(0);
  const restarted = await startDocumentServer(fixture);
  servers.push(restarted);
  const fresh = (await restarted.open("app/CLAUDE.md", context)).body;
  const history = await restarted.post<RevisionHistory>("history", {
    documentId: fresh.documentId
  });
  expect(history.body.revisions).toHaveLength(1);
  expect(history.body.revisions[0]).toMatchObject({
    kind: "before-save",
    current: false
  });
  const revisionId = history.body.revisions[0]!.revisionId;
  const revision = await restarted.post<RevisionContent>("revision", {
    documentId: fresh.documentId,
    revisionId
  });
  expect(revision.body.content).toBe("first\n");
  const restored = await restarted.post<MutationResult>("restore", {
    documentId: fresh.documentId,
    sourceKey: fresh.sourceKey,
    expectedVersion: fresh.version,
    revisionId
  });
  expect(restored.body.outcome).toBe("saved");
  expect(readFileSync(path)).toEqual(Buffer.from("﻿first\r\n"));
  const after = await restarted.post<RevisionHistory>("history", {
    documentId: fresh.documentId
  });
  expect(after.body.revisions.map((item) => item.kind)).toEqual([
    "before-restore",
    "before-save"
  ]);
  expect(after.body.revisions[1]?.current).toBe(true);
});

it("keeps history private and outside the source folder", async () => {
  const { fixture, server } = await setup();
  const document = (await server.open(".claude/CLAUDE.md")).body;
  await save(server, { document, content: "changed\n" });
  const folder = join(fixture.history, document.sourceKey);
  expect(statSync(fixture.history).mode & 0o777).toBe(0o700);
  expect(statSync(folder).mode & 0o777).toBe(0o700);
  const listing = await server.post<RevisionHistory>("history", {
    documentId: document.documentId
  });
  const file = join(folder, `${listing.body.revisions[0]!.revisionId}.json`);
  expect(statSync(file).mode & 0o777).toBe(0o600);
});

it("never reads another file's revision through this document", async () => {
  const { fixture, server } = await setup();
  const global = (await server.open(".claude/CLAUDE.md")).body;
  await save(server, { document: global, content: "global change\n" });
  const listing = await server.post<RevisionHistory>("history", {
    documentId: global.documentId
  });
  const foreignId = listing.body.revisions[0]!.revisionId;
  const project = (
    await server.open("app/CLAUDE.md", {
      scope: "project",
      path: fixture.project
    })
  ).body;
  const read = await server.post("revision", {
    documentId: project.documentId,
    revisionId: foreignId
  });
  expect(read.status).toBe(404);
  const restore = await server.post("restore", {
    documentId: project.documentId,
    sourceKey: project.sourceKey,
    expectedVersion: project.version,
    revisionId: "../../etc/passwd"
  });
  expect(restore.status).toBe(404);
});

it("does not snapshot an unchanged save", async () => {
  const { server } = await setup();
  const document = (await server.open(".claude/CLAUDE.md")).body;
  const reply = await server.post<MutationResult>("save", {
    documentId: document.documentId,
    sourceKey: document.sourceKey,
    expectedVersion: document.version,
    content: document.content
  });
  expect(reply.body.outcome).toBe("unchanged");
  expect(reply.body.revisionId).toBeUndefined();
  const history = await server.post<RevisionHistory>("history", {
    documentId: document.documentId
  });
  expect(history.body).toEqual({ revisions: [], problems: [] });
});
