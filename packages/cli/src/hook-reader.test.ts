import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildGlobalSnapshot, buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-hooks-"));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project, codexHome: join(home, ".codex") };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function directHookFiles(options: ReturnType<typeof fixture>): void {
  mkdirSync(join(options.home, ".claude"));
  mkdirSync(options.codexHome);
  mkdirSync(join(options.project, ".claude"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "private-value",
                async: true,
                timeout: 10
              }
            ]
          }
        ]
      }
    })
  );
  writeFileSync(
    join(options.project, ".claude", "settings.json"),
    JSON.stringify({
      hooks: {
        Stop: [{ hooks: [{ type: "prompt", prompt: "private-value" }] }]
      }
    })
  );
  writeFileSync(
    join(options.codexHome, "hooks.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "private-value" }] }
        ]
      }
    })
  );
}

it("reads direct Claude and Codex hooks without exporting handler content", async () => {
  const options = fixture();
  directHookFiles(options);
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.hooks.map((hook) => [hook.tool, hook.event, hook.availability])
  ).toEqual([
    ["claude", "PreToolUse", "configured"],
    ["claude", "Stop", "configured"],
    ["codex", "SessionStart", "unknown"]
  ]);
  expect(snapshot.hooks[0]).toMatchObject({
    lane: "Before tool",
    matcher: "Bash",
    handlerType: "command",
    locator: "hooks.PreToolUse[0].hooks[0]",
    flags: ["async", "timeout: 10"]
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
  const global = await buildGlobalSnapshot(options);
  expect(global.hooks.map((hook) => hook.event)).toEqual([
    "PreToolUse",
    "SessionStart"
  ]);
});

it("reads Codex inline TOML hooks and preserves project trust uncertainty", async () => {
  const options = fixture();
  mkdirSync(options.codexHome);
  mkdirSync(join(options.project, ".codex"));
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "private-value"\n'
  );
  writeFileSync(
    join(options.project, ".codex", "config.toml"),
    '[[hooks.PreToolUse]]\nmatcher = "Bash"\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = "private-value"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.hooks.map((hook) => [hook.event, hook.scope, hook.availability])
  ).toEqual([
    ["Stop", "global", "unknown"],
    ["PreToolUse", "project", "unknown"]
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("keeps inline TOML hook locators local to each event", async () => {
  const options = fixture();
  mkdirSync(options.codexHome);
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\n[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks.map((hook) => hook.locator)).toEqual([
    "hooks.Stop[0].hooks[0]",
    "hooks.PreToolUse[0].hooks[0]"
  ]);
});

it("marks Claude hook declarations disabled when settings disable hooks", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({
      disableAllHooks: true,
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "private-value" }] }]
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks[0]).toMatchObject({
    event: "Stop",
    availability: "disabled"
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("marks Codex hooks disabled when the user feature flag is off", async () => {
  const options = fixture();
  mkdirSync(options.codexHome);
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[features]\nhooks = false\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks[0]).toMatchObject({
    event: "Stop",
    availability: "disabled"
  });
});

it("keeps unfamiliar events in Other and hides unsafe matchers", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({
      hooks: {
        FutureEvent: [
          {
            matcher: "https://user:private-value@example.com",
            hooks: [{ type: "http", url: "https://private-value@example.com" }]
          }
        ]
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks[0]).toMatchObject({
    event: "FutureEvent",
    lane: "Other",
    matcher: "hidden; open source",
    handlerType: "http"
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("reports malformed shared settings once without exposing their contents", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    "{private-value"
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.coverage.filter((note) =>
      note.includes("Could not read valid JSON")
    )
  ).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
