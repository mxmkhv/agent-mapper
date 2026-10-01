import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  DocumentError,
  SourceDeletePlan,
  SourceDeleteResult,
  SourceRef
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

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** The Trash is a folder inside the fixture, so tests never touch the real one. */
async function setup() {
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

it("moves a skill folder to the Trash with everything in it", async () => {
  const { fixture, ref, remove } = await setup();
  const folder = join(fixture.project, ".claude/skills/deploy");
  const { plan, apply } = await remove(await ref("deploy/SKILL.md", "project"));
  expect(plan).toMatchObject({
    kind: "skill",
    path: folder,
    target: "folder",
    files: 2
  });
  expect(plan.blocked).toBeUndefined();
  expect(apply.body).toEqual({ trashed: folder });
  expect(existsSync(folder)).toBe(false);
  expect(existsSync(join(fixture.home, "Trash/deploy/run.sh"))).toBe(true);
});

it("removes only the link when a skill folder is a symlink", async () => {
  const { fixture, ref, remove } = await setup();
  const { plan, apply } = await remove(await ref("linked/SKILL.md", "project"));
  expect(plan).toMatchObject({
    target: "link",
    linkTarget: join(fixture.home, "library/linked")
  });
  expect(apply.status).toBe(200);
  expect(existsSync(join(fixture.project, ".claude/skills/linked"))).toBe(
    false
  );
  expect(existsSync(join(fixture.home, "library/linked/SKILL.md"))).toBe(true);
});

it("moves an agent file to the Trash", async () => {
  const { fixture, ref, remove } = await setup();
  const { plan, apply } = await remove(
    await ref(".claude/agents/reviewer.md", "project")
  );
  expect(plan).toMatchObject({ kind: "agent", target: "file", files: 1 });
  expect(apply.status).toBe(200);
  expect(existsSync(join(fixture.project, ".claude/agents/reviewer.md"))).toBe(
    false
  );
});

it("refuses plugin skills and files that are not skills or agents", async () => {
  const { trashed, ref, post } = await setup();
  const plugin = await ref("review/SKILL.md", "global");
  const blocked = await post<SourceDeletePlan>("plan", { source: plugin });
  expect(blocked.body.blocked).toBe(
    "Plugin files are managed by the plugin. Disable or uninstall the plugin instead."
  );
  const refused = await post("apply", {
    source: plugin,
    fingerprint: blocked.body.fingerprint
  });
  expect(refused.status).toBe(403);
  const instruction = await post("plan", {
    source: await ref("work/app/CLAUDE.md", "project")
  });
  expect(instruction.status).toBe(400);
  expect(trashed).toEqual([]);
});

it("refuses a skill that a linked folder leads into a plugin's files", async () => {
  const { fixture, trashed, ref, remove } = await setup();
  // The project's Codex skills folder is a link into the plugin cache, so the skill there carries no plugin ID.
  mkdirSync(join(fixture.project, ".agents"));
  symlinkSync(
    join(fixture.home, ".claude/plugins/cache/market/reviewer/1.0.0/skills"),
    join(fixture.project, ".agents/skills")
  );
  const { plan, apply } = await remove(
    await ref(".agents/skills/review/SKILL.md", "project")
  );
  expect(plan.blocked).toBe(
    "This lives in a plugin or managed folder, which stays read-only."
  );
  expect(apply.status).toBe(403);
  expect(trashed).toEqual([]);
});

it("stops when the folder changed since the plan, even at the same size", async () => {
  const { fixture, trashed, ref, post } = await setup();
  const source = await ref("deploy/SKILL.md", "project");
  const plan = await post<SourceDeletePlan>("plan", { source });
  write(join(fixture.project, ".claude/skills/deploy/run.sh"), "echo SHIP\n");
  const stale = await post("apply", {
    source,
    fingerprint: plan.body.fingerprint
  });
  expect(stale.status).toBe(409);
  expect(trashed).toEqual([]);
});

it("stops when a link points somewhere else since the plan", async () => {
  const { fixture, trashed, ref, post } = await setup();
  const source = await ref("linked/SKILL.md", "project");
  const plan = await post<SourceDeletePlan>("plan", { source });
  const link = join(fixture.project, ".claude/skills/linked");
  write(join(fixture.home, "elsewhere/SKILL.md"), "---\nname: linked\n---\n");
  rmSync(link);
  symlinkSync(join(fixture.home, "elsewhere"), link);
  const stale = await post("apply", {
    source,
    fingerprint: plan.body.fingerprint
  });
  expect(stale.status).toBe(409);
  expect(trashed).toEqual([]);
});

it("warns about other paths that lead to the deleted folder", async () => {
  const { fixture, ref, post } = await setup();
  // Both ~/.claude/skills and ~/.agents/skills link to shared/skills, so deleting one deletes the other.
  const plan = await post<SourceDeletePlan>("plan", {
    source: await ref(".claude/skills/writer/SKILL.md", "global")
  });
  expect(plan.body.target).toBe("folder");
  expect(plan.body.warnings).toEqual([
    `${join(fixture.home, ".agents/skills/writer/SKILL.md")} also leads here and will stop working.`
  ]);
});

it("removes a broken agent link and names the missing file", async () => {
  const { fixture, ref, remove } = await setup();
  const link = join(fixture.project, ".claude/agents/ghost.md");
  symlinkSync(join(fixture.home, "gone/ghost.md"), link);
  const { plan, apply } = await remove(
    await ref(".claude/agents/ghost.md", "project")
  );
  expect(plan).toMatchObject({
    target: "link",
    broken: true,
    linkTarget: join(fixture.home, "gone/ghost.md")
  });
  expect(apply.status).toBe(200);
  expect(existsSync(link)).toBe(false);
});
