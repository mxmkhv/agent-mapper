import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildSnapshot } from "./service";

it("uses the nearest Codex plugin setting in a nested folder", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-nested-plugin-"))
  );
  try {
    const codexHome = join(home, ".codex");
    const project = join(home, "app");
    const nested = join(project, "packages", "app");
    const nestedConfig = join(nested, ".codex", "config.toml");
    mkdirSync(join(project, ".git"), { recursive: true });
    mkdirSync(join(codexHome, "plugins", "cache", "market", "reviewer", "1"), {
      recursive: true
    });
    mkdirSync(join(project, ".codex"));
    mkdirSync(join(nested, ".codex"), { recursive: true });
    writeFileSync(
      join(codexHome, "config.toml"),
      '[plugins."reviewer@market"]\nenabled = true\n'
    );
    writeFileSync(
      join(project, ".codex", "config.toml"),
      '[plugins."reviewer@market"]\nenabled = true\n'
    );
    writeFileSync(
      nestedConfig,
      '[plugins."reviewer@market"]\nenabled = false\n'
    );
    const disabled = await buildSnapshot(nested, { home, codexHome });
    expect(
      disabled.plugins.find((item) => item.key === "reviewer@market")
    ).toMatchObject({ state: "unknown", settingsEvidence: nestedConfig });
    writeFileSync(
      join(codexHome, "config.toml"),
      '[plugins."reviewer@market"]\nenabled = false\n'
    );
    writeFileSync(
      nestedConfig,
      '[plugins."reviewer@market"]\nenabled = true\n'
    );
    const enabled = await buildSnapshot(nested, { home, codexHome });
    expect(
      enabled.plugins.find((item) => item.key === "reviewer@market")
    ).toMatchObject({ state: "unknown", settingsEvidence: nestedConfig });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("reads Codex plugin settings written as literal keys, dotted keys, and inline tables", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-toml-plugin-"))
  );
  try {
    const codexHome = join(home, ".codex");
    const project = join(home, "app");
    const cache = join(codexHome, "plugins", "cache", "market");
    mkdirSync(join(project, ".git"), { recursive: true });
    for (const name of ["literal", "dotted", "inline"]) {
      mkdirSync(join(cache, name, "1"), { recursive: true });
    }
    writeFileSync(
      join(codexHome, "config.toml"),
      [
        "[plugins.'literal@market']",
        "enabled = false",
        "[plugins]",
        'inline = """',
        "enabled = true",
        '"""',
        '"dotted@market".enabled = true',
        '"inline@market" = { enabled = false }'
      ].join("\n")
    );
    const snapshot = await buildSnapshot(project, { home, codexHome });
    expect(
      snapshot.plugins
        .filter((item) => item.tool === "codex")
        .map((item) => [item.key, item.state])
    ).toEqual([
      ["dotted@market", "selected"],
      ["inline@market", "disabled"],
      ["literal@market", "disabled"]
    ]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("reports a disabled, uninstalled Codex plugin as disabled instead of missing", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-disabled-plugin-"))
  );
  try {
    const codexHome = join(home, ".codex");
    const project = join(home, "app");
    mkdirSync(join(project, ".git"), { recursive: true });
    mkdirSync(codexHome);
    writeFileSync(
      join(codexHome, "config.toml"),
      '[plugins."old@market"]\nenabled = false\n'
    );
    const snapshot = await buildSnapshot(project, { home, codexHome });
    expect(
      snapshot.plugins.find((item) => item.key === "old@market")
    ).toMatchObject({ state: "disabled" });
    expect(
      snapshot.findings.some((item) => item.code === "missing-plugin")
    ).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
