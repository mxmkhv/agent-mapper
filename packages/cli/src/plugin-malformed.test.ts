import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
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

it("reads Codex portable skills, MCP, and extension hooks", async () => {
  const options = fixture();
  const root = join(
    options.codexHome,
    "plugins",
    "cache",
    "market",
    "bundle",
    "1"
  );
  mkdirSync(join(root, "skills", "check"), { recursive: true });
  mkdirSync(join(root, "hooks"));
  writeFileSync(
    join(root, "skills", "check", "SKILL.md"),
    "---\nname: check\n---\nBody"
  );
  writeFileSync(
    join(root, "mcp.json"),
    JSON.stringify({ mcpServers: { docs: { url: "https://example.com" } } })
  );
  writeFileSync(
    join(root, "hooks", "extra.json"),
    JSON.stringify({ hooks: { Stop: [] } })
  );
  writeFileSync(
    join(root, "plugin.json"),
    JSON.stringify({
      name: "bundle",
      version: "1",
      extensions: { "com.openai": { hooks: "./hooks/extra.json" } }
    })
  );
  mkdirSync(options.codexHome, { recursive: true });
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[plugins."bundle@market"]\nenabled = true\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  const plugin = snapshot.plugins.find((item) => item.key === "bundle@market");
  expect(plugin?.state).toBe("selected");
  expect(plugin?.contributions.map((item) => [item.kind, item.name])).toEqual([
    ["skill", "check"],
    ["mcp", "docs"],
    ["hook", "Stop"]
  ]);
  expect(
    snapshot.items.some((item) => item.entry.pluginId === plugin?.id)
  ).toBe(true);
});

it("attaches a malformed manifest warning to its plugin", async () => {
  const options = fixture();
  const root = join(
    options.codexHome,
    "plugins",
    "cache",
    "market",
    "broken",
    "1"
  );
  mkdirSync(join(root, ".codex-plugin"), { recursive: true });
  writeFileSync(join(root, ".codex-plugin", "plugin.json"), "{private-value");
  mkdirSync(options.codexHome, { recursive: true });
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[plugins."broken@market"]\nenabled = true\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  const broken = snapshot.plugins.find((item) => item.key === "broken@market");
  expect(broken?.issues).toEqual([
    expect.stringContaining("Could not read valid JSON")
  ]);
  expect(broken?.sourcePath).toBe(join(root, ".codex-plugin", "plugin.json"));
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("keeps a broken cached version visible", async () => {
  const options = fixture();
  const parent = join(
    options.codexHome,
    "plugins",
    "cache",
    "market",
    "broken-link"
  );
  mkdirSync(parent, { recursive: true });
  symlinkSync(join(parent, "missing"), join(parent, "1"));
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.plugins.find((item) => item.key === "broken-link@market")
  ).toMatchObject({
    state: "missing",
    reason: "Installation path is missing or unreadable."
  });
  expect(snapshot.findings).toContainEqual(
    expect.objectContaining({ code: "missing-plugin", level: "problem" })
  );
});

it("keeps an inline Claude command's file provenance", async () => {
  const options = fixture();
  const root = join(
    options.home,
    ".claude",
    "plugins",
    "cache",
    "market",
    "commands",
    "1"
  );
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  mkdirSync(join(root, "commands"));
  writeFileSync(join(root, "commands", "status.md"), "private-value");
  writeFileSync(
    join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "commands",
      commands: {
        status: { source: "./commands/status.md" }
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  const contribution = snapshot.plugins.find(
    (item) => item.key === "commands@market"
  )?.contributions[0];
  expect(contribution).toMatchObject({
    kind: "command",
    name: "status",
    sourcePath: join(root, "commands", "status.md")
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
