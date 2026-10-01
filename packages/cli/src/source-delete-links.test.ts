import { existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { SourceDeletePlan } from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import { cleanupDeletes, setupDeletes, write } from "./source-delete-test-kit";

afterEach(cleanupDeletes);

it("removes only the link when a skill folder is a symlink", async () => {
  const { fixture, ref, remove } = await setupDeletes();
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

it("stops when a link points somewhere else since the plan", async () => {
  const { fixture, trashed, ref, post } = await setupDeletes();
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

it("removes a broken agent link and names the missing file", async () => {
  const { fixture, ref, remove } = await setupDeletes();
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

it("removes a skill link whose folder is gone", async () => {
  const { fixture, ref, remove } = await setupDeletes();
  const link = join(fixture.project, ".claude/skills/vanished");
  symlinkSync(join(fixture.home, "gone/vanished"), link);
  const { plan, apply } = await remove(
    await ref(".claude/skills/vanished", "project")
  );
  expect(plan).toMatchObject({
    kind: "skill",
    target: "link",
    broken: true,
    path: link
  });
  expect(apply.status).toBe(200);
  expect(existsSync(link)).toBe(false);
});
