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
import { buildSnapshot } from "./service";
import { scanHooks } from "./hook-reader";
import { CodexTomlReader } from "./codex-toml";

const skipped = (notes: string[]) =>
  notes.filter((note) => note.endsWith("it was skipped."));

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-hooks-")));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project, codexHome: join(home, ".codex") };
}

it("reports hook declarations of the wrong shape instead of dropping them", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  const settings = join(options.home, ".claude", "settings.json");
  writeFileSync(
    settings,
    JSON.stringify({
      hooks: {
        Stop: { hooks: [] },
        PreToolUse: ["Bash", { hooks: ["./check.sh"] }]
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toEqual([]);
  expect(skipped(snapshot.coverage)).toEqual(
    expect.arrayContaining([
      `${settings}: hooks.Stop must be a list of matcher groups; it was skipped.`,
      `${settings}: hooks.PreToolUse[0] must be an object with a hooks list; it was skipped.`,
      `${settings}: hooks.PreToolUse[1].hooks[0] must be an object; it was skipped.`
    ])
  );
});

it("adds no shape notes for well-formed or absent declarations", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ model: "x" })
  );
  writeFileSync(
    join(options.project, ".mcp.json"),
    JSON.stringify({ mcpServers: { local: { command: "node" } } })
  );
  writeFileSync(join(options.home, ".claude.json"), JSON.stringify({}));
  mkdirSync(options.codexHome);
  writeFileSync(join(options.codexHome, "config.toml"), 'model = "x"\n');
  const snapshot = await buildSnapshot(options.project, options);
  expect(skipped(snapshot.coverage)).toEqual([]);
});

it("treats hook file paths in a plugin manifest as references, not malformed hooks", async () => {
  const options = fixture();
  const manifest = join(options.home, "plugin.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      hooks: [
        "./hooks/extra.json",
        { Stop: [{ hooks: [{ type: "command", command: "./stop.sh" }] }] }
      ]
    })
  );
  const result = await scanHooks({
    root: options.project,
    claudeConfigDir: join(options.home, ".claude"),
    codexHome: options.codexHome,
    workingDirectory: options.project,
    plugins: [
      {
        id: "p",
        tool: "claude",
        key: "p@m",
        name: "p",
        scope: "global",
        state: "selected",
        reason: "Fixture",
        sourcePath: manifest,
        contributions: [{ kind: "hook", name: "Stop", sourcePath: manifest }]
      }
    ],
    entries: [],
    agents: [],
    managedSettings: [],
    contentFor: () => undefined,
    toml: new CodexTomlReader()
  });
  expect(result.hooks.map((hook) => hook.event)).toEqual(["Stop"]);
  expect(skipped(result.errors)).toEqual([]);
});
