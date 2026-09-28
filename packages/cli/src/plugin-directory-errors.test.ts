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
import { markdownFiles, skillFiles } from "./plugin-contribution-utils";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reports an unreadable plugin cache instead of silently treating it as empty", async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-cache-")));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(project);
  mkdirSync(join(home, ".codex", "plugins"), { recursive: true });
  writeFileSync(join(home, ".codex", "plugins", "cache"), "not a directory");
  writeFileSync(
    join(home, ".codex", "config.toml"),
    '[plugins."example@market"]\nenabled = true\n'
  );
  const snapshot = await buildSnapshot(project, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.coverage).toContainEqual(
    expect.stringContaining("Could not list plugin cache directory")
  );
  expect(snapshot.plugins).toMatchObject([
    {
      key: "example@market",
      state: "unknown",
      reason:
        "The plugin cache could not be fully read; installation cannot be verified."
    }
  ]);
});

it("reports plugin skill and Markdown directory listing failures", async () => {
  const root = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-plugin-dir-"))
  );
  roots.push(root);
  const file = join(root, "plain-file");
  writeFileSync(file, "not a directory");
  const errors: string[] = [];
  expect(await skillFiles(file, errors)).toEqual([]);
  expect(await markdownFiles(file, { errors })).toEqual([]);
  expect(errors).toEqual([
    `${file}: Could not list plugin skills. Check permissions.`,
    `${file}: Could not list plugin Markdown files. Check permissions.`
  ]);
});

it("does not claim an enabled Claude plugin is missing when its cache is unreadable", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-claude-cache-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const plugins = join(home, ".claude", "plugins");
  mkdirSync(project);
  mkdirSync(plugins, { recursive: true });
  writeFileSync(join(plugins, "cache"), "not a directory");
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { "example@market": true } })
  );
  const snapshot = await buildSnapshot(project, {
    home,
    claudeConfigDir: join(home, ".claude")
  });
  expect(snapshot.plugins).toContainEqual(
    expect.objectContaining({ key: "example@market", state: "unknown" })
  );
  expect(snapshot.coverage).toContainEqual(
    expect.stringContaining("Could not list plugin cache directory")
  );
});
