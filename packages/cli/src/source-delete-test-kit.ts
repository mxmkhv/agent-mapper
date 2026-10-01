import { mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  DocumentError,
  SourceDeletePlan,
  SourceDeleteResult,
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
/** Closes servers and removes fixtures; call from `afterEach`. */
export async function cleanupDeletes(): Promise<void> {
  for (const server of servers.splice(0)) {
    await server.close();
  }
  for (const fixture of fixtures.splice(0)) {
    removeFixture(fixture);
  }
}

export function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** The Trash is a folder inside the fixture, so tests never touch the real one. */
export async function setupDeletes() {
  const fixture = documentFixture();
  fixtures.push(fixture);
  const trash = join(fixture.home, "Trash");
  mkdirSync(trash);
  const trashed: string[] = [];
  const client = await startDocumentServer(fixture, {
    trash: async (path) => {
      trashed.push(path);
      renameSync(path, join(trash, basename(path)));
    }
  });
  servers.push(client);
  addItems(fixture);
  const { project } = fixture;

  async function ref(suffix: string, scope: "global" | "project") {
    const snapshot = await client.scan(
      scope === "project" ? project : undefined
    );
    const id =
      snapshot.items.find(({ entry }) => entry.path.endsWith(suffix))?.entry
        .id ??
      snapshot.agents.find((agent) => agent.sourcePath.endsWith(suffix))?.id;
    if (!id) {
      throw new Error(`Fixture has nothing scanned at ${suffix}.`);
    }
    return { scope, workingDirectory: snapshot.workingDirectory, entryId: id };
  }

  const post = <T>(route: "plan" | "apply", body: DeleteBody) =>
    postDelete<T>(client, { route, body });

  async function remove(source: SourceRef) {
    const plan = await post<SourceDeletePlan>("plan", { source });
    const apply = await post<SourceDeleteResult>("apply", {
      source,
      fingerprint: plan.body.fingerprint
    });
    return { plan: plan.body, apply };
  }

  return { fixture, trashed, ref, post, remove };
}

interface DeleteBody {
  source: SourceRef;
  fingerprint?: string;
}

async function postDelete<T>(
  client: { base: string; headers: Record<string, string> },
  { route, body }: { route: "plan" | "apply"; body: DeleteBody }
) {
  const response = await fetch(`${client.base}/api/source-delete/${route}`, {
    method: "POST",
    headers: { ...client.headers, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: (await response.json()) as T & { error?: DocumentError }
  };
}

/** A project skill folder, a symlinked project skill, a project agent, and a Codex link to the global skills. */
function addItems({ project, home }: DocumentFixture): void {
  write(
    join(project, ".claude/skills/deploy/SKILL.md"),
    "---\nname: deploy\ndescription: Ships\n---\n"
  );
  write(join(project, ".claude/skills/deploy/run.sh"), "echo ship\n");
  write(
    join(home, "library/linked/SKILL.md"),
    "---\nname: linked\ndescription: Shared\n---\n"
  );
  symlinkSync(
    join(home, "library/linked"),
    join(project, ".claude/skills/linked")
  );
  write(
    join(project, ".claude/agents/reviewer.md"),
    "---\nname: reviewer\ndescription: Reviews\n---\nRead.\n"
  );
  mkdirSync(join(home, ".agents"));
  symlinkSync(join(home, "shared/skills"), join(home, ".agents/skills"));
}
