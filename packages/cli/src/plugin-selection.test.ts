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

const roots: string[] = [];

function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-selection-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const plugins = join(home, ".claude", "plugins");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(plugins, { recursive: true });
  return { home, project, plugins, codexHome: join(home, ".codex") };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function installation(
  options: ReturnType<typeof fixture>,
  data: { key: string; scope: string; installPath: string }
): void {
  writeFileSync(
    join(options.plugins, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        [data.key]: [{ scope: data.scope, installPath: data.installPath }]
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { [data.key]: true } })
  );
}

function skill(path: string): void {
  const directory = join(path, "skills", "review");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "SKILL.md"),
    "---\nname: review\n---\nPrivate skill body"
  );
}

it("does not select a project-scoped Claude plugin without confirmed trust", async () => {
  const options = fixture();
  const path = join(options.plugins, "cache", "market", "reviewer", "1");
  skill(path);
  installation(options, {
    key: "reviewer@market",
    scope: "project",
    installPath: path
  });
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins.find((item) => item.key === "reviewer@market")
  ).toMatchObject({
    state: "unknown",
    reason: expect.stringContaining("trust")
  });
  expect(snapshot.items.some((item) => item.entry.pluginId)).toBe(false);
});

it("keeps a local-scope installation tied to its project", async () => {
  const options = fixture();
  const path = join(options.plugins, "cache", "market", "reviewer", "1");
  skill(path);
  writeFileSync(
    join(options.plugins, "installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": [
          {
            scope: "local",
            projectPath: options.project,
            installPath: path
          }
        ]
      }
    })
  );
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
  const project = await buildSnapshot(options.project, options);
  expect(
    project.plugins.find((item) => item.key === "reviewer@market")
  ).toMatchObject({
    scope: "project",
    state: "unknown"
  });
  const sibling = join(options.home, "other");
  mkdirSync(join(sibling, ".git"), { recursive: true });
  const elsewhere = await buildSnapshot(sibling, options);
  expect(
    elsewhere.plugins.find((item) => item.key === "reviewer@market")
  ).toMatchObject({
    state: "unknown",
    reason: expect.stringContaining("no matching installation record")
  });
});

it("does not attribute another plugin's cache files to an install record", async () => {
  const options = fixture();
  const path = join(options.plugins, "cache", "market", "other", "1");
  skill(path);
  installation(options, {
    key: "reviewer@market",
    scope: "user",
    installPath: path
  });
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins
      .filter((item) => item.tool === "claude")
      .map((item) => [item.key, item.state])
  ).toEqual([
    ["reviewer@market", "unknown"],
    ["other@market", "cached"]
  ]);
  expect(snapshot.items.some((item) => item.entry.pluginId)).toBe(false);
  expect(JSON.stringify(snapshot)).not.toContain("Private skill body");
});

it("does not report a disabled, uninstalled plugin as missing", async () => {
  const options = fixture();
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "old@market": false } })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins.find((item) => item.key === "old@market")
  ).toMatchObject({
    state: "disabled"
  });
  expect(snapshot.findings.some((item) => item.code === "missing-plugin")).toBe(
    false
  );
});

it("keeps cached copies distinct from enabled and disabled settings", async () => {
  const options = fixture();
  const cache = join(options.plugins, "cache", "market");
  skill(join(cache, "enabled", "1"));
  skill(join(cache, "disabled", "1"));
  writeFileSync(
    join(options.home, ".claude", "settings.json"),
    JSON.stringify({
      enabledPlugins: {
        "enabled@market": true,
        "disabled@market": false
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins
      .filter((item) => item.tool === "claude")
      .map((item) => [item.key, item.state])
      .sort((a, b) => a[0]!.localeCompare(b[0]!))
  ).toEqual([
    ["disabled@market", "disabled"],
    ["enabled@market", "unknown"]
  ]);
  expect(snapshot.items.some((item) => item.entry.pluginId)).toBe(false);
});
