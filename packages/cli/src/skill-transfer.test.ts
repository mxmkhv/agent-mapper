import { existsSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  SkillTransferPlan,
  SkillTransferResult
} from "@agent-mapper/core";
import { afterEach, expect, it } from "vitest";
import {
  cleanupSkillTransfers,
  setupSkillTransfer as setup,
  write
} from "./skill-transfer-test-kit";

afterEach(cleanupSkillTransfers);

it("copies a skill into another project for both tools", async () => {
  const { fixture, client, other, ref, transfer } = await setup();
  const source = await ref(fixture.project, ".claude/skills/writer/SKILL.md");
  const { plan, apply } = await transfer({
    source,
    mode: "copy",
    projectPath: other,
    tools: ["claude", "codex"]
  });
  expect(plan.blocked).toBeUndefined();
  expect(plan.destinations.map((item) => item.conflict)).toEqual([
    undefined,
    undefined
  ]);
  expect(apply.status).toBe(200);
  for (const folder of [".claude/skills/writer", ".agents/skills/writer"]) {
    expect(readFileSync(join(other, folder, "SKILL.md"), "utf8")).toContain(
      "Write well."
    );
  }
  // The source stays, and the reported IDs are the ones the next scan assigns.
  expect(existsSync(join(fixture.home, "shared/skills/writer"))).toBe(true);
  const ids = (await client.scan(other)).items.map(({ entry }) => entry.id);
  for (const created of apply.body.created) {
    expect(ids).toContain(created.entryId);
  }
});

it("never overwrites an existing skill folder", async () => {
  const { fixture, other, ref, transfer, post } = await setup();
  const body = {
    source: await ref(fixture.project, ".claude/skills/writer/SKILL.md"),
    mode: "copy",
    projectPath: other,
    tools: ["claude"]
  };
  await transfer(body);
  const again = await transfer(body);
  expect(again.plan.destinations[0]?.conflict).toBe(
    "An identical copy is already here."
  );
  expect(again.apply.status).toBe(409);
  write(join(other, ".agents/skills/writer/SKILL.md"), "# Mine\n");
  const codex = await post<SkillTransferPlan>("plan", {
    ...body,
    tools: ["codex"]
  });
  expect(codex.body.destinations[0]?.conflict).toContain("already exists");
  expect(
    readFileSync(join(other, ".agents/skills/writer/SKILL.md"), "utf8")
  ).toBe("# Mine\n");
});

it("moves a project skill to the global folders and keeps script modes", async () => {
  const { fixture, deploy, ref, transfer } = await setup();
  const source = await ref(fixture.project, ".claude/skills/deploy/SKILL.md");
  const { plan, apply } = await transfer({
    source,
    mode: "promote",
    tools: ["claude", "codex"]
  });
  expect(plan.files.map((file) => file.path)).toEqual([
    "SKILL.md",
    "scripts",
    "scripts/run.sh"
  ]);
  expect(plan.warnings.join("\n")).toContain("allowed-tools");
  expect(plan.warnings.join("\n")).toContain("context injection");
  expect(apply.status).toBe(200);
  expect(apply.body.removed).toBe(deploy);
  expect(existsSync(deploy)).toBe(false);
  // ~/.claude/skills links to shared/skills, so the Claude copy lands there.
  for (const folder of ["shared/skills/deploy", ".agents/skills/deploy"]) {
    const script = join(fixture.home, folder, "scripts/run.sh");
    expect(statSync(script).mode & 0o777).toBe(0o755);
  }
});

it("refuses to move global skills, linked folders and outside links", async () => {
  const { fixture, deploy, ref, post } = await setup();
  const global = await post<SkillTransferPlan>("plan", {
    source: await ref(fixture.project, ".claude/skills/writer/SKILL.md"),
    mode: "promote",
    tools: ["claude"]
  });
  expect(global.body.blocked).toContain("Only a project's own skills");
  symlinkSync("../../../../shared", join(deploy, "shared"));
  const outside = await post<SkillTransferPlan>("plan", {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "promote",
    tools: ["codex"]
  });
  expect(outside.body.blocked).toContain("links outside the skill folder");
  const apply = await post<SkillTransferResult>("apply", {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "promote",
    tools: ["codex"],
    fingerprint: outside.body.fingerprint || "none"
  });
  expect(apply.status).toBe(400);
  expect(existsSync(join(deploy, "SKILL.md"))).toBe(true);
});

it("stops when the skill changed after the preview", async () => {
  const { fixture, deploy, other, ref, post } = await setup();
  const body = {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: other,
    tools: ["codex"]
  };
  const plan = await post<SkillTransferPlan>("plan", body);
  write(join(deploy, "notes.md"), "Added later.\n");
  const apply = await post<SkillTransferResult>("apply", {
    ...body,
    fingerprint: plan.body.fingerprint
  });
  expect(apply.status).toBe(409);
  expect(existsSync(join(other, ".agents/skills"))).toBe(false);
});

it("copies only into projects the app knows", async () => {
  const { fixture, ref, post } = await setup();
  const plan = await post<SkillTransferPlan>("plan", {
    source: await ref(fixture.project, ".claude/skills/deploy/SKILL.md"),
    mode: "copy",
    projectPath: join(fixture.home, "elsewhere"),
    tools: ["claude"]
  });
  expect(plan.status).toBe(400);
  expect(plan.body.error?.message).toContain("Choose a project");
});
