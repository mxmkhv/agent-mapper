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
