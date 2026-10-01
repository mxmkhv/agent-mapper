import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-command-plugin-"));
  roots.push(home);
  const project = join(home, "app");
  const plugins = join(home, ".claude", "plugins");
  const selected = join(plugins, "cache", "market", "reviewer", "1");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(join(selected, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(selected, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "reviewer" })
  );
  writeFileSync(
    join(plugins, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": [
          { scope: "user", installPath: selected, version: "1" }
        ]
      }
    })
  );
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
  return { home, project, selected };
}

it("links selected command files and keeps cached copies out of the inventory", async () => {
  const options = fixture();
  const cached = join(
    options.home,
    ".claude",
    "plugins",
    "cache",
    "market",
    "reviewer",
    "2"
  );
  mkdirSync(join(options.selected, "commands", "frontend"), {
    recursive: true
  });
  mkdirSync(join(cached, "commands"), { recursive: true });
  const command = join(
    options.selected,
    "commands",
    "frontend",
    "component.md"
  );
  writeFileSync(command, "Private selected command");
  writeFileSync(join(cached, "commands", "old.md"), "Private cached command");
  const snapshot = await buildSnapshot(options.project, options);
  const plugin = snapshot.plugins.find(
    (item) => item.key === "reviewer@market" && item.state === "selected"
  );
  const contribution = plugin?.contributions.find(
    (item) => item.kind === "command" && item.name === "frontend:component"
  );
  expect(
    snapshot.items.find(({ entry }) => entry.id === contribution?.entryId)
      ?.entry
  ).toMatchObject({
    kind: "command",
    name: "reviewer:frontend:component",
    path: command,
    pluginId: plugin?.id
  });
  expect(
    snapshot.items.some(({ entry }) => entry.name === "reviewer:old")
  ).toBe(false);
  expect(JSON.stringify(snapshot)).not.toContain("Private selected command");
});

it("links inline declarations without estimating manifest text as command body", async () => {
  const options = fixture();
  const manifest = join(options.selected, ".claude-plugin", "plugin.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      name: "reviewer",
      commands: { status: { prompt: "private-value" } }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  const plugin = snapshot.plugins.find(
    (item) => item.key === "reviewer@market" && item.state === "selected"
  );
  const contribution = plugin?.contributions.find(
    (item) => item.kind === "command" && item.name === "status"
  );
  expect(
    snapshot.items.find(({ entry }) => entry.id === contribution?.entryId)
      ?.entry
  ).toMatchObject({
    kind: "command",
    name: "reviewer:status",
    path: manifest,
    locator: "commands.status",
    declarationOnly: true
  });
  expect(snapshot.context.claude.unaccountedSources).toBeGreaterThan(0);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
