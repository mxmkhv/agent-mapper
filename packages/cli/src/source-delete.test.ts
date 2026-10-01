import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  symlinkSync,
  truncateSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import type { SourceDeletePlan } from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import { cleanupDeletes, setupDeletes, write } from "./source-delete-test-kit";

afterEach(cleanupDeletes);

it("moves a skill folder to the Trash with everything in it", async () => {
  const { fixture, ref, remove } = await setupDeletes();
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

it("moves an agent file to the Trash", async () => {
  const { fixture, ref, remove } = await setupDeletes();
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
  const { trashed, ref, post } = await setupDeletes();
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
  const { fixture, trashed, ref, remove } = await setupDeletes();
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
  const { fixture, trashed, ref, post } = await setupDeletes();
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

it("warns about other paths that lead to the deleted folder", async () => {
  const { fixture, ref, post } = await setupDeletes();
  // Both ~/.claude/skills and ~/.agents/skills link to shared/skills, so deleting one deletes the other.
  const plan = await post<SourceDeletePlan>("plan", {
    source: await ref(".claude/skills/writer/SKILL.md", "global")
  });
  expect(plan.body.target).toBe("folder");
  expect(plan.body.warnings).toEqual([
    `${join(fixture.home, ".agents/skills/writer/SKILL.md")} also leads here and will stop working.`
  ]);
});

it("refuses a folder too large to check before deleting", async () => {
  const { fixture, trashed, ref, remove } = await setupDeletes();
  const folder = join(fixture.project, ".claude/skills/deploy/vendor");
  mkdirSync(folder);
  for (let index = 0; index < 1000; index += 1) {
    writeFileSync(join(folder, `${index}.txt`), "x");
  }
  const { plan, apply } = await remove(await ref("deploy/SKILL.md", "project"));
  expect(plan.tooLarge).toBe("items");
  expect(plan.blocked).toContain("too much to check before deleting");
  expect(apply.status).toBe(403);
  expect(trashed).toEqual([]);
});

it("refuses a folder over the byte cap without reading it", async () => {
  const { fixture, trashed, ref, remove } = await setupDeletes();
  // Sparse: the size is what the cap sees, without writing 51 MiB.
  const big = join(fixture.project, ".claude/skills/deploy/big.bin");
  writeFileSync(big, "");
  truncateSync(big, 51 * 1024 * 1024);
  const { plan, apply } = await remove(await ref("deploy/SKILL.md", "project"));
  expect(plan.tooLarge).toBe("bytes");
  expect(plan.blocked).toContain("more than 50 MiB");
  expect(apply.status).toBe(403);
  expect(trashed).toEqual([]);
});

it("deletes a folder holding a pipe without reading the pipe", async () => {
  const { fixture, trashed, ref, remove } = await setupDeletes();
  const folder = join(fixture.project, ".claude/skills/deploy");
  execFileSync("mkfifo", [join(folder, "pipe")]);
  const { plan, apply } = await remove(await ref("deploy/SKILL.md", "project"));
  expect(plan.blocked).toBeUndefined();
  expect(apply.status).toBe(200);
  expect(trashed).toEqual([folder]);
});
