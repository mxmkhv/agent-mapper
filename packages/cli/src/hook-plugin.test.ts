import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

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

it("links selected plugin hook declarations to their parent", async () => {
  const options = fixture();
  const root = join(options.home, ".claude", "plugins");
  const pluginPath = join(root, "cache", "market", "reviewer", "1");
  mkdirSync(join(pluginPath, "hooks"), { recursive: true });
  writeFileSync(
    join(pluginPath, "hooks", "hooks.json"),
    JSON.stringify({
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "private-value" }] }]
      }
    })
  );
  writeFileSync(
    join(root, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": [{ scope: "user", installPath: pluginPath }]
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
  const snapshot = await buildSnapshot(options.project, options);
  const plugin = snapshot.plugins.find(
    (item) => item.key === "reviewer@market"
  );
  expect(snapshot.hooks).toMatchObject([
    { event: "Stop", pluginId: plugin?.id, availability: "configured" }
  ]);
  expect(
    plugin?.contributions.find((item) => item.kind === "hook")?.entryId
  ).toBe(snapshot.hooks[0]?.id);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("reads portable plugin inline hook arrays with distinct locators", async () => {
  const options = fixture();
  const root = join(
    options.codexHome,
    "plugins",
    "cache",
    "market",
    "inline",
    "1"
  );
  mkdirSync(root, { recursive: true });
  mkdirSync(options.codexHome, { recursive: true });
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[plugins."inline@market"]\nenabled = true\n'
  );
  writeFileSync(
    join(root, "plugin.json"),
    JSON.stringify({
      name: "inline",
      extensions: {
        "com.openai": {
          hooks: [
            {
              Stop: [{ hooks: [{ type: "command", command: "private-value" }] }]
            },
            {
              Stop: [{ hooks: [{ type: "command", command: "private-value" }] }]
            }
          ]
        }
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks.map((hook) => hook.locator)).toEqual([
    "extensions.com.openai.hooks[0].Stop[0].hooks[0]",
    "extensions.com.openai.hooks[1].Stop[0].hooks[0]"
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
