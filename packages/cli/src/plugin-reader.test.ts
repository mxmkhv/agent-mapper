import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-plugin-"));
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

function recordClaudeInstallation(
  options: ReturnType<typeof fixture>,
  pluginPath: string
): void {
  mkdirSync(join(options.home, ".claude", "plugins"), { recursive: true });
  writeFileSync(
    join(options.home, ".claude", "plugins", "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": [
          { scope: "user", installPath: pluginPath, version: "1.0.0" }
        ]
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
}

function selectedClaudeFixture(options: ReturnType<typeof fixture>): void {
  const pluginPath = join(
    options.home,
    ".claude",
    "plugins",
    "cache",
    "market",
    "reviewer",
    "1.0.0"
  );
  mkdirSync(join(pluginPath, "skills", "review"), { recursive: true });
  mkdirSync(join(pluginPath, "agents", "teams"), { recursive: true });
  mkdirSync(join(pluginPath, ".claude-plugin"));
  mkdirSync(join(pluginPath, "hooks"));
  writeFileSync(
    join(pluginPath, "hooks", "hooks.json"),
    JSON.stringify({ hooks: { Stop: [] } })
  );
  writeFileSync(
    join(pluginPath, ".mcp.json"),
    JSON.stringify({
      mcpServers: { local: { env: { SECRET: "private-value" } } }
    })
  );
  writeFileSync(
    join(pluginPath, "skills", "review", "SKILL.md"),
    "---\nname: review\ndescription: private-value\n---\nprivate-value"
  );
  writeFileSync(
    join(pluginPath, "agents", "teams", "reviewer.md"),
    "private-value"
  );
  writeFileSync(
    join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "reviewer", version: "1.0.0" })
  );
  recordClaudeInstallation(options, pluginPath);
}

it("links a selected Claude plugin to its skill without exposing file content", async () => {
  const options = fixture();
  selectedClaudeFixture(options);
  const snapshot = await buildSnapshot(options.project, options);
  const plugin = snapshot.plugins.find(
    (item) => item.key === "reviewer@market"
  );
  expect(plugin).toMatchObject({
    tool: "claude",
    state: "selected",
    version: "1.0.0"
  });
  expect(plugin?.contributions.map((item) => [item.kind, item.name])).toEqual([
    ["skill", "review"],
    ["agent", "teams/reviewer"],
    ["hook", "Stop"],
    ["mcp", "local"]
  ]);
  const skill = snapshot.items.find(
    (item) => item.entry.pluginId === plugin?.id
  );
  expect(skill?.entry.id).toBe(plugin?.contributions[0]?.entryId);
  const mcp = snapshot.mcpServers.find(
    (server) => server.pluginId === plugin?.id
  );
  expect(mcp?.id).toBe(
    plugin?.contributions.find((item) => item.kind === "mcp")?.entryId
  );
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("keeps disabled and cached Claude copies distinct", async () => {
  const options = fixture();
  const root = join(options.home, ".claude", "plugins");
  const installed = join(root, "cache", "market", "first", "1");
  const cached = join(root, "cache", "market", "second", "2");
  mkdirSync(installed, { recursive: true });
  mkdirSync(cached, { recursive: true });
  writeFileSync(
    join(root, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "first@market": [
          { scope: "user", installPath: installed, version: "1" }
        ]
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({
      enabledPlugins: { "first@market": false, "missing@market": true }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins
      .filter((item) => item.tool === "claude")
      .map((item) => [item.key, item.state])
  ).toEqual([
    ["first@market", "disabled"],
    ["second@market", "cached"],
    ["missing@market", "missing"]
  ]);
});

it("does not select a Claude version when installation records disagree", async () => {
  const options = fixture();
  const root = join(options.home, ".claude", "plugins");
  const paths = ["1", "2"].map((version) =>
    join(root, "cache", "market", "reviewer", version)
  );
  for (const path of paths) {
    mkdirSync(path, { recursive: true });
  }
  writeFileSync(
    join(root, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": paths.map((installPath) => ({
          scope: "user",
          installPath
        }))
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins
      .filter((item) => item.key === "reviewer@market")
      .map((item) => item.state)
  ).toEqual(["unknown", "unknown"]);
});

it("marks Codex selection unknown when multiple versions are cached", async () => {
  const options = fixture();
  const cache = join(
    options.codexHome,
    "plugins",
    "cache",
    "market",
    "reviewer"
  );
  mkdirSync(join(cache, "1"), { recursive: true });
  mkdirSync(join(cache, "2"), { recursive: true });
  mkdirSync(options.codexHome, { recursive: true });
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[plugins."reviewer@market"]\nenabled = true\n[plugins."missing@market"]\nenabled = true\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins
      .filter((item) => item.tool === "codex")
      .map((item) => [item.key, item.state])
  ).toEqual([
    ["reviewer@market", "unknown"],
    ["reviewer@market", "unknown"],
    ["missing@market", "missing"]
  ]);
});

it("reports malformed installation records without hiding other plugins", async () => {
  const options = fixture();
  const root = join(options.home, ".claude", "plugins");
  mkdirSync(join(root, "cache", "market", "survivor", "1"), {
    recursive: true
  });
  writeFileSync(join(root, "installed_plugins.json"), "{private-value");
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.plugins.some((item) => item.key === "survivor@market")).toBe(
    true
  );
  expect(
    snapshot.coverage.some((note) => note.includes("Could not read valid JSON"))
  ).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
