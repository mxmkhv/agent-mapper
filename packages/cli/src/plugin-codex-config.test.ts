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
