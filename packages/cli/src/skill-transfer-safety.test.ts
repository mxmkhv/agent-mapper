import { existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  SkillTransferPlan,
  SkillTransferResult
} from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import {
  cleanupSkillTransfers,
  readOnly,
  setupSkillTransfer as setup,
  write
} from "./skill-transfer-test-kit";

afterEach(cleanupSkillTransfers);

it("copies once when one tool's skills folder links to the other's", async () => {
  const { fixture, other, ref, transfer } = await setup();
  mkdirSync(join(other, ".claude/skills"), { recursive: true });
  mkdirSync(join(other, ".agents"));
  symlinkSync("../.claude/skills", join(other, ".agents/skills"));
  const { plan, apply } = await transfer({
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: other,
    tools: ["claude", "codex"]
  });
  expect(plan.destinations).toHaveLength(1);
  expect(plan.warnings[0]).toContain("so one copy serves Codex too");
  // The shared folder still serves Codex, so its portability warnings stay.
  expect(plan.warnings.join("\n")).toContain("allowed-tools");
  expect(apply.status).toBe(200);
  expect(readdirSync(join(other, ".claude/skills"))).toEqual(["deploy"]);
});

it("removes the first copy and the folders it made when the second fails", async () => {
  const { fixture, other, ref, transfer } = await setup();
  mkdirSync(join(other, ".agents"));
  readOnly(join(other, ".agents"));
  const { apply } = await transfer({
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: other,
    tools: ["claude", "codex"]
  });
  expect(apply.status).toBe(403);
  expect(existsSync(join(other, ".claude"))).toBe(false);
  expect(readdirSync(join(other, ".agents"))).toEqual([]);
});

it("keeps the project skill when a move stops before writing", async () => {
  const { fixture, deploy, ref, post } = await setup();
  const body = {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "promote",
    tools: ["codex"]
  };
  const stale = await post<SkillTransferResult>("apply", {
    ...body,
    fingerprint: "stale"
  });
  expect(stale.status).toBe(409);
  mkdirSync(join(fixture.home, ".agents/skills/deploy"), { recursive: true });
  const plan = await post<SkillTransferPlan>("plan", body);
  const taken = await post<SkillTransferResult>("apply", {
    ...body,
    fingerprint: plan.body.fingerprint
  });
  expect(taken.status).toBe(409);
  expect(existsSync(join(deploy, "SKILL.md"))).toBe(true);
});

it("refuses to move a skill folder that is a link", async () => {
  const { fixture, ref, post } = await setup();
  const linked = join(fixture.project, ".claude/skills/scribe");
  symlinkSync(join(fixture.home, "shared/skills/writer"), linked);
  const plan = await post<SkillTransferPlan>("plan", {
    source: await ref(fixture.project, ".claude/skills/scribe/SKILL.md"),
    mode: "promote",
    tools: ["codex"]
  });
  expect(plan.body.blocked).toContain("through a link");
  expect(existsSync(join(fixture.home, "shared/skills/writer"))).toBe(true);
});

it("refuses to move a skill whose skills folder is shared through a link", async () => {
  const { fixture, ref, post } = await setup();
  const shared = join(fixture.home, "dotfiles/skills/lint");
  write(join(shared, "SKILL.md"), "---\nname: lint\ndescription: Lints\n---\n");
  const linked = join(fixture.home, "work/linked");
  mkdirSync(join(linked, ".git"), { recursive: true });
  mkdirSync(join(linked, ".claude"));
  symlinkSync(
    join(fixture.home, "dotfiles/skills"),
    join(linked, ".claude/skills")
  );
  const plan = await post<SkillTransferPlan>("plan", {
    source: await ref(linked, ".claude/skills/lint/SKILL.md"),
    mode: "promote",
    tools: ["codex"]
  });
  expect(plan.body.blocked).toContain("other projects may share");
  expect(existsSync(join(shared, "SKILL.md"))).toBe(true);
});

it("reports a partly removed project skill and keeps the global copy", async () => {
  const { fixture, client, deploy, ref, transfer } = await setup();
  readOnly(join(deploy, "scripts"));
  const { apply } = await transfer({
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "promote",
    tools: ["codex"]
  });
  const global = join(fixture.home, ".agents/skills/deploy");
  readOnly(join(global, "scripts"));
  expect(apply.status).toBe(200);
  expect(apply.body.removed).toBeUndefined();
  expect(apply.body.warnings[0]).toContain("may be partly deleted");
  expect(existsSync(join(global, "scripts/run.sh"))).toBe(true);
  const ids = (await client.scan(fixture.project)).items.map(
    ({ entry }) => entry.id
  );
  expect(ids).toContain(apply.body.created[0]?.entryId);
});

it("refuses a destination that leads into a managed folder", async () => {
  const { fixture, other, ref, transfer } = await setup();
  mkdirSync(join(other, ".agents"));
  symlinkSync(join(fixture.home, "managed"), join(other, ".agents/skills"));
  const { plan, apply } = await transfer({
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: other,
    tools: ["codex"]
  });
  expect(plan.destinations[0]?.conflict).toContain("stays read-only");
  expect(apply.status).toBe(409);
  expect(existsSync(join(fixture.home, "managed/deploy"))).toBe(false);
});

it("refuses a link that escapes through another link", async () => {
  const { fixture, deploy, ref, post } = await setup();
  write(join(deploy, "../outside"), "Not part of the skill.\n");
  symlinkSync(".", join(deploy, "a"));
  mkdirSync(join(deploy, "dir"));
  symlinkSync("../a/../outside", join(deploy, "dir/link"));
  const plan = await post<SkillTransferPlan>("plan", {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: join(fixture.home, "work/other"),
    tools: ["claude"]
  });
  expect(plan.body.blocked).toContain(
    "dir/link leads outside the skill folder"
  );
});
