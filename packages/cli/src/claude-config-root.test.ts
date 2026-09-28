import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-root-")));
  roots.push(root);
  const home = join(root, "home");
  const project = join(root, "app");
  const claudeConfigDir = join(home, "claude-profile");
  mkdirSync(home);
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(join(home, ".claude"));
  mkdirSync(claudeConfigDir);
  writeFileSync(join(home, ".claude", "CLAUDE.md"), "Wrong user root");
  writeFileSync(
    join(home, ".claude.json"),
    JSON.stringify({ mcpServers: { wrong: { command: "wrong" } } })
  );
  return { home, project, claudeConfigDir };
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writePlugin(claudeConfigDir: string): void {
  const pluginPath = join(
    claudeConfigDir,
    "plugins",
    "cache",
    "market",
    "reviewer",
    "1.0.0"
  );
  mkdirSync(join(pluginPath, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(claudeConfigDir, "plugins", "installed_plugins.json"),
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
    join(pluginPath, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "reviewer", version: "1.0.0" })
  );
}

function writeCustomSources(options: ReturnType<typeof fixture>): void {
  const { claudeConfigDir, project } = options;
  mkdirSync(join(claudeConfigDir, "skills", "review"), { recursive: true });
  mkdirSync(join(claudeConfigDir, "commands"));
  mkdirSync(join(claudeConfigDir, "agents"));
  const memory = join(
    claudeConfigDir,
    "projects",
    project.replace(/[^A-Za-z0-9]/g, "-"),
    "memory"
  );
  mkdirSync(memory, { recursive: true });
  writePlugin(claudeConfigDir);
  writeFileSync(join(claudeConfigDir, "CLAUDE.md"), "Custom user root");
  writeFileSync(
    join(claudeConfigDir, "skills", "review", "SKILL.md"),
    "---\nname: review\ndescription: Review changes\n---\nPrivate skill body"
  );
  writeFileSync(join(claudeConfigDir, "commands", "check.md"), "Check changes");
  writeFileSync(
    join(claudeConfigDir, "agents", "reviewer.md"),
    "---\nname: reviewer\ndescription: Review changes\n---\nPrivate agent body"
  );
  writeFileSync(join(memory, "MEMORY.md"), "Private memory body");
  writeFileSync(
    join(claudeConfigDir, "settings.json"),
    JSON.stringify({
      enabledPlugins: { "reviewer@market": true },
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "printf custom" }] }]
      }
    })
  );
  writeFileSync(
    join(claudeConfigDir, ".claude.json"),
    JSON.stringify({ mcpServers: { custom: { command: "node" } } })
  );
}

it("uses one custom Claude root across global readers", async () => {
  const options = fixture();
  writeCustomSources(options);
  const snapshot = await buildSnapshot(options.project, options);

  expect(snapshot.roots.claude).toBe(options.claudeConfigDir);
  expect(
    snapshot.items
      .filter(({ entry }) => entry.tool === "claude")
      .map(({ entry }) => entry.path)
  ).toEqual([
    join(options.claudeConfigDir, "CLAUDE.md"),
    join(options.claudeConfigDir, "skills", "review", "SKILL.md"),
    join(options.claudeConfigDir, "commands", "check.md")
  ]);
  expect(snapshot.agents.map(({ sourcePath }) => sourcePath)).toEqual([
    join(options.claudeConfigDir, "agents", "reviewer.md")
  ]);
  expect(snapshot.hooks.map(({ sourcePath }) => sourcePath)).toEqual([
    join(options.claudeConfigDir, "settings.json")
  ]);
  expect(snapshot.memories.map(({ sourcePath }) => sourcePath)).toEqual([
    join(
      options.claudeConfigDir,
      "projects",
      options.project.replace(/[^A-Za-z0-9]/g, "-"),
      "memory",
      "MEMORY.md"
    )
  ]);
  expect(snapshot.plugins).toMatchObject([
    { key: "reviewer@market", state: "selected" }
  ]);
  expect(snapshot.mcpServers.map(({ name }) => name)).toEqual(["custom"]);
  expect(JSON.stringify(snapshot)).not.toContain("Private skill body");
});

it("reads CLAUDE_CONFIG_DIR from the environment", async () => {
  const options = fixture();
  writeCustomSources(options);
  vi.stubEnv("CLAUDE_CONFIG_DIR", options.claudeConfigDir);
  const snapshot = await buildSnapshot(options.project, { home: options.home });
  expect(snapshot.roots.claude).toBe(options.claudeConfigDir);
  expect(snapshot.mcpServers.map(({ name }) => name)).toEqual(["custom"]);
});

it("resolves a relative Claude root from the selected folder", async () => {
  const options = fixture();
  const relativeRoot = join(options.project, "profile");
  mkdirSync(relativeRoot);
  writeFileSync(join(relativeRoot, "CLAUDE.md"), "Relative user root");
  vi.stubEnv("CLAUDE_CONFIG_DIR", "profile");

  const snapshot = await buildSnapshot(options.project, { home: options.home });
  expect(snapshot.roots.claude).toBe(relativeRoot);
  expect(
    snapshot.items.some(
      ({ entry }) => entry.path === join(relativeRoot, "CLAUDE.md")
    )
  ).toBe(true);
});
