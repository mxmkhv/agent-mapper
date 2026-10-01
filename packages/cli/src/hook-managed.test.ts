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
    mkdtempSync(join(tmpdir(), "agent-mapper-managed-hooks-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const managedClaudeDir = join(home, "managed");
  mkdirSync(project);
  mkdirSync(managedClaudeDir);
  return { home, project, managedClaudeDir };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function hook(event: string) {
  return {
    hooks: {
      [event]: [
        {
          hooks: [
            { type: "command", command: "./check.sh --token private-value" }
          ]
        }
      ]
    }
  };
}

it("inventories hooks from the managed file and ordered drop-ins", async () => {
  const options = fixture();
  const main = join(options.managedClaudeDir, "managed-settings.json");
  const split = join(options.managedClaudeDir, "managed-settings.d");
  mkdirSync(split);
  writeFileSync(main, JSON.stringify(hook("PreToolUse")));
  writeFileSync(join(split, "20-stop.json"), JSON.stringify(hook("Stop")));
  writeFileSync(
    join(split, ".hidden.json"),
    JSON.stringify(hook("SessionEnd"))
  );

  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.hooks.map(({ event, scope, availability, sourcePath }) => [
      event,
      scope,
      availability,
      sourcePath
    ])
  ).toEqual([
    ["PreToolUse", "managed", "unknown", main],
    ["Stop", "managed", "unknown", join(split, "20-stop.json")]
  ]);
  expect(snapshot.hooks[0]?.locator).toBe("hooks.PreToolUse[0].hooks[0]");
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
  const global = await buildGlobalSnapshot(options);
  expect(global.hooks.map((item) => item.event)).toEqual([
    "PreToolUse",
    "Stop"
  ]);
});

it("does not let user hook disable suppress a managed declaration", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  writeFileSync(
    join(options.managedClaudeDir, "managed-settings.json"),
    JSON.stringify(hook("Stop"))
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ ...hook("PreToolUse"), disableAllHooks: true })
  );

  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.hooks.map(({ event, availability }) => [event, availability])
  ).toEqual([
    ["PreToolUse", "disabled"],
    ["Stop", "unknown"]
  ]);
});

it("marks local managed hook restrictions as unverified", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  const managed = join(options.managedClaudeDir, "managed-settings.json");
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify(hook("PreToolUse"))
  );
  writeFileSync(
    managed,
    JSON.stringify({ ...hook("Stop"), allowManagedHooksOnly: true })
  );
  const restricted = await buildSnapshot(options.project, options);
  expect(restricted.hooks.map(({ availability }) => availability)).toEqual([
    "unknown",
    "unknown"
  ]);

  writeFileSync(
    managed,
    JSON.stringify({ ...hook("Stop"), disableAllHooks: true })
  );
  const disabled = await buildSnapshot(options.project, options);
  expect(disabled.hooks.map(({ availability }) => availability)).toEqual([
    "unknown",
    "unknown"
  ]);
});

it("reports invalid managed hook settings without exporting their values", async () => {
  const options = fixture();
  const path = join(options.managedClaudeDir, "managed-settings.json");
  writeFileSync(
    path,
    JSON.stringify({ hooks: "private-value", disableAllHooks: "private-value" })
  );

  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.coverage).toContain(
    `${path}: Managed hooks must be an event map.`
  );
  expect(snapshot.coverage).toContain(
    `${path}: disableAllHooks must be a boolean.`
  );
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
