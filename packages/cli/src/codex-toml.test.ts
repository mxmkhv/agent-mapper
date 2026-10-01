import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-codex-toml-"));
  roots.push(home);
  const project = join(home, "app");
  const codexHome = join(home, ".codex");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(codexHome);
  return { home, project, codexHome };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reads inline MCP tables, dotted keys, and multiline URL strings", async () => {
  const options = fixture();
  mkdirSync(join(options.project, ".codex"));
  writeFileSync(
    join(options.codexHome, "config.toml"),
    'mcp_servers = { local = { command = "node" }, remote = { url = """\nhttps://example.org/private-value\n""" } }\n'
  );
  writeFileSync(
    join(options.project, ".codex", "config.toml"),
    'mcp_servers.project.command = "node"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.mcpServers.map(({ name, transport, destination }) => [
      name,
      transport,
      destination
    ])
  ).toEqual([
    ["local", "stdio", "node"],
    ["remote", "http", "https://example.org"],
    ["project", "stdio", "node"]
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("reads inline and dotted hook groups with multiline handler strings", async () => {
  const options = fixture();
  mkdirSync(join(options.project, ".codex"));
  writeFileSync(
    join(options.codexHome, "config.toml"),
    'hooks = { Stop = [{ hooks = [{ type = "command", command = "./check.sh --token private-value" }] }] }\nfeatures = { hooks = true }\n'
  );
  writeFileSync(
    join(options.project, ".codex", "config.toml"),
    'hooks.PreToolUse = [{ matcher = "Bash", hooks = [{ type = """command\\\n""", timeout = 10, command = "./check.sh --token private-value" }] }]\nfeatures.hooks = true\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.hooks.map(({ locator, handlerType }) => [locator, handlerType])
  ).toEqual([
    ["hooks.Stop[0].hooks[0]", "command"],
    ["hooks.PreToolUse[0].hooks[0]", "command"]
  ]);
  expect(snapshot.hooks[1]).toMatchObject({
    matcher: "Bash",
    flags: ["timeout: 10"]
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("applies an inline Codex hooks feature setting", async () => {
  const options = fixture();
  writeFileSync(
    join(options.codexHome, "config.toml"),
    'hooks = { Stop = [{ hooks = [{ type = "command", command = "check" }] }] }\nfeatures = { hooks = false }\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toHaveLength(1);
  expect(snapshot.hooks[0]?.availability).toBe("disabled");
});

it("reports malformed TOML once across hook and MCP readers", async () => {
  const options = fixture();
  const path = join(options.codexHome, "config.toml");
  writeFileSync(path, "mcp_servers = { private-value =");
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toEqual([]);
  expect(snapshot.mcpServers).toEqual([]);
  expect(
    snapshot.coverage.filter((message) =>
      message.startsWith(`${path}: Could not parse Codex TOML settings.`)
    )
  ).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
