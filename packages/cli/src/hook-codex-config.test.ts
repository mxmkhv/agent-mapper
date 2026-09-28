import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildSnapshot } from "./service";

it("reads Codex TOML hooks in nested project config layers", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-nested-hooks-"));
  try {
    const project = join(home, "app");
    const nested = join(project, "packages", "app");
    mkdirSync(join(project, ".git"), { recursive: true });
    mkdirSync(join(project, ".codex"));
    mkdirSync(join(nested, ".codex"), { recursive: true });
    writeFileSync(
      join(project, ".codex", "config.toml"),
      '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "private-value"\n'
    );
    writeFileSync(
      join(nested, ".codex", "config.toml"),
      '[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\ncommand = "private-value"\n'
    );
    writeFileSync(
      join(nested, ".codex", "hooks.json"),
      JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [{ type: "command", command: "private-value" }] }
          ]
        }
      })
    );
    const snapshot = await buildSnapshot(nested, {
      home,
      codexHome: join(home, ".codex")
    });
    expect(
      snapshot.hooks.map(({ event, scope, availability }) => [
        event,
        scope,
        availability
      ])
    ).toEqual([
      ["SessionStart", "project", "unknown"],
      ["Stop", "project", "unknown"],
      ["PreToolUse", "project", "unknown"]
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("private-value");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("keeps opposing user and project hook flags uncertain until trust is known", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-hook-flags-"));
  try {
    const codexHome = join(home, ".codex");
    const project = join(home, "app");
    const nested = join(project, "packages", "app");
    const nestedConfig = join(nested, ".codex", "config.toml");
    mkdirSync(codexHome);
    mkdirSync(join(project, ".git"), { recursive: true });
    mkdirSync(join(nested, ".codex"), { recursive: true });
    writeFileSync(
      join(codexHome, "config.toml"),
      '[features]\nhooks = false\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\n'
    );
    writeFileSync(nestedConfig, "[features]\nhooks = true\n");
    const enabled = await buildSnapshot(nested, { home, codexHome });
    expect(enabled.hooks[0]).toMatchObject({
      availability: "unknown",
      reason: expect.stringContaining("trusted")
    });
    writeFileSync(
      join(codexHome, "config.toml"),
      '[features]\nhooks = true\n[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\n'
    );
    writeFileSync(nestedConfig, "[features]\nhooks = false\n");
    const disabled = await buildSnapshot(nested, { home, codexHome });
    expect(disabled.hooks[0]).toMatchObject({
      availability: "unknown",
      reason: expect.stringContaining("trusted")
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("keeps hook group locators unique across unrelated TOML tables", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-hook-groups-"));
  try {
    const codexHome = join(home, ".codex");
    const project = join(home, "app");
    mkdirSync(codexHome);
    mkdirSync(project);
    writeFileSync(
      join(codexHome, "config.toml"),
      '[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\n[features]\nhooks = true\n[[hooks.PreToolUse]]\n[[hooks.PreToolUse.hooks]]\ntype = "command"\n'
    );
    const snapshot = await buildSnapshot(project, { home, codexHome });
    expect(snapshot.hooks.map((hook) => hook.locator)).toEqual([
      "hooks.PreToolUse[0].hooks[0]",
      "hooks.PreToolUse[1].hooks[0]"
    ]);
    expect(new Set(snapshot.hooks.map((hook) => hook.id)).size).toBe(2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
