import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildGlobalSnapshot, buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-frontmatter-"))
  );
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reads skill and agent frontmatter hooks as conditional declarations", async () => {
  const options = fixture();
  const skill = join(options.project, ".claude", "skills", "check", "SKILL.md");
  const agent = join(options.home, ".claude", "agents", "review.md");
  mkdirSync(join(options.project, ".claude", "skills", "check"), {
    recursive: true
  });
  mkdirSync(join(options.home, ".claude", "agents"), { recursive: true });
  writeFileSync(
    skill,
    '---\nname: check\nhooks:\n  PreToolUse:\n    - matcher: "Bash"\n      hooks:\n        - type: command\n          command: API_TOKEN=private-skill-command ./check.sh\n          once: true\n---\nSkill body'
  );
  writeFileSync(
    agent,
    "---\nname: review\ndescription: Review code\nhooks:\n  Stop:\n    - hooks:\n        - type: prompt\n          prompt: Review with --api-key private-agent-prompt\n---\nAgent body"
  );

  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toMatchObject([
    {
      event: "PreToolUse",
      sourcePath: skill,
      scope: "project",
      locator: "frontmatter.hooks.PreToolUse[0].hooks[0]",
      matcher: "Bash",
      handlerType: "command",
      flags: ["once"],
      availability: "conditional"
    },
    {
      event: "Stop",
      sourcePath: agent,
      scope: "global",
      locator: "frontmatter.hooks.Stop[0].hooks[0]",
      handlerType: "prompt",
      availability: "conditional"
    }
  ]);
  expect(JSON.stringify(snapshot)).not.toMatch(/private-skill|private-agent/);
  const global = await buildGlobalSnapshot(options);
  expect(global.hooks.map((hook) => hook.sourcePath)).toEqual([agent]);
});

it("reports malformed hook frontmatter without exporting its content", async () => {
  const options = fixture();
  const skill = join(options.home, ".claude", "skills", "broken", "SKILL.md");
  mkdirSync(join(options.home, ".claude", "skills", "broken"), {
    recursive: true
  });
  writeFileSync(
    skill,
    "---\nname: broken\nhooks:\n  Stop: [private-value\n---\nBody"
  );

  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toEqual([]);
  expect(snapshot.coverage).toContain(
    `${skill}: Could not parse hook frontmatter YAML.`
  );
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("marks hooks on a shadowed agent unresolved and project hooks trust-dependent", async () => {
  const options = fixture();
  const global = join(options.home, ".claude", "agents", "review.md");
  const project = join(options.project, ".claude", "agents", "review.md");
  mkdirSync(join(options.home, ".claude", "agents"), { recursive: true });
  mkdirSync(join(options.project, ".claude", "agents"), {
    recursive: true
  });
  const content =
    "---\nname: review\ndescription: Review code\nhooks:\n  Stop:\n    - hooks:\n        - type: command\n          command: ./check.sh --token private-value\n---\nBody";
  writeFileSync(global, content);
  writeFileSync(project, content);

  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks.map(({ availability }) => availability)).toEqual([
    "unknown",
    "conditional"
  ]);
  expect(snapshot.hooks[0]?.reason).toContain("nearer project agent");
  expect(snapshot.hooks[1]?.reason).toContain("trust is not verified");
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
