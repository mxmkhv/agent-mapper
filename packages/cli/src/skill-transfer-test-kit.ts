import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  DocumentError,
  SkillTransferPlan,
  SkillTransferResult,
  SourceRef
} from "@agent-mapper/core";
import {
  documentFixture,
  removeFixture,
  startDocumentServer,
  type DocumentFixture
} from "./source-document-test-kit";

const fixtures: DocumentFixture[] = [];
const servers: { close(): Promise<void> }[] = [];
const readOnlyMode = 0o555;
const openMode = 0o755;
const restores: (() => void)[] = [];

/** Closes servers and removes fixtures; call from `afterEach`. */
export async function cleanupSkillTransfers(): Promise<void> {
  for (const restore of restores.splice(0)) {
    restore();
  }
  for (const server of servers.splice(0)) {
    await server.close();
  }
  for (const fixture of fixtures.splice(0)) {
    removeFixture(fixture);
  }
}

/** Makes a folder read-only for one test; its mode is restored before the fixture is removed. */
export function readOnly(path: string): void {
  chmodSync(path, readOnlyMode);
  restores.push(() => chmodSync(path, openMode));
}

export function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Adds a project skill with a script, and a second project to copy into. */
function skillFixture() {
  const fixture = documentFixture();
  fixtures.push(fixture);
  const deploy = join(fixture.project, ".claude/skills/deploy");
  write(
    join(deploy, "SKILL.md"),
    "---\nname: deploy\ndescription: Ships it\nallowed-tools: Bash\n---\n\nRun !`git status` first.\n"
  );
  write(join(deploy, "scripts/run.sh"), "#!/bin/sh\necho ship\n");
  chmodSync(join(deploy, "scripts/run.sh"), openMode);
  const other = join(fixture.home, "work/other");
  mkdirSync(join(other, ".git"), { recursive: true });
  return { fixture, deploy, other };
}

export async function setupSkillTransfer() {
  const { fixture, deploy, other } = skillFixture();
  const client = await startDocumentServer(fixture);
  servers.push(client);

  async function ref(path: string, suffix: string): Promise<SourceRef> {
    const snapshot = await client.scan(path);
    const entry = snapshot.items.find(({ entry }) =>
      entry.path.endsWith(suffix)
    )?.entry;
    if (!entry) {
      throw new Error(`Fixture has no scanned entry ending with ${suffix}.`);
    }
    return {
      scope: "project",
      workingDirectory: snapshot.workingDirectory,
      entryId: entry.id
    };
  }

  async function post<T>(
    route: "plan" | "apply",
    body: Record<string, unknown>
  ) {
    const response = await fetch(`${client.base}/api/skill-transfer/${route}`, {
      method: "POST",
      headers: { ...client.headers, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      body: (await response.json()) as T & { error?: DocumentError }
    };
  }

  async function transfer(body: Record<string, unknown>) {
    const plan = await post<SkillTransferPlan>("plan", body);
    const apply = await post<SkillTransferResult>("apply", {
      ...body,
      fingerprint: plan.body.fingerprint
    });
    return { plan: plan.body, apply };
  }

  await client.scan(other);
  return { fixture, client, other, deploy, ref, post, transfer };
}
