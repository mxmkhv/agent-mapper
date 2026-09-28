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
import { buildGlobalSnapshot, buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-mcp-"));
  roots.push(home);
  const project = join(home, "app");
  const codexHome = join(home, ".codex");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(codexHome);
  return { home, project: realpathSync(project), codexHome };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeClaudeSources(options: ReturnType<typeof fixture>): void {
  writeFileSync(
    join(options.home, ".claude.json"),
    JSON.stringify({
      mcpServers: {
        shared: {
          type: "http",
          url: "https://user:private-value@example.com/path?token=private-value",
          headers: { Authorization: "private-value" }
        }
      },
      projects: {
        [options.project]: {
          mcpServers: {
            shared: {
              command: "node",
              args: ["private-value"],
              env: { API_KEY: "private-value" }
            }
          }
        }
      }
    })
  );
  writeFileSync(
    join(options.project, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        shared: { type: "sse", url: "https://example.org/private-value" },
        local: { command: "/usr/local/bin/server", args: ["private-value"] }
      }
    })
  );
}

it("reads Claude scopes and redacts URL credentials, arguments, and secret values", async () => {
  const options = fixture();
  writeClaudeSources(options);
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.mcpServers.map(({ name, scope, availability }) => [
      name,
      scope,
      availability
    ])
  ).toEqual([
    ["shared", "global", "shadowed"],
    ["shared", "project", "configured"],
    ["shared", "project", "shadowed"],
    ["local", "project", "approval required"]
  ]);
  expect(snapshot.mcpServers[0]).toMatchObject({
    destination: "https://example.com",
    headerNames: ["Authorization"]
  });
  expect(snapshot.mcpServers[1]).toMatchObject({
    destination: "node",
    envNames: ["API_KEY"]
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
  const global = await buildGlobalSnapshot(options);
  expect(global.mcpServers.map((server) => server.name)).toEqual(["shared"]);
});

it("reads Codex user and project declarations with disabled state", async () => {
  const options = fixture();
  mkdirSync(join(options.project, ".codex"));
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[mcp_servers.files]\ncommand = "node"\nargs = ["private-value"]\n[mcp_servers.remote]\nurl = "https://private-value@example.com/private-value?token=private-value"\nenabled = false\n'
  );
  writeFileSync(
    join(options.project, ".codex", "config.toml"),
    '[mcp_servers."project docs"]\nurl = "https://example.org/private-value"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.mcpServers.map(({ name, transport, availability }) => [
      name,
      transport,
      availability
    ])
  ).toEqual([
    ["files", "stdio", "configured"],
    ["remote", "http", "disabled"],
    ["project docs", "http", "unknown"]
  ]);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("reads Codex MCP layers through the selected folder", async () => {
  const options = fixture();
  const nested = join(options.project, "packages", "app");
  mkdirSync(join(options.project, ".codex"));
  mkdirSync(join(nested, ".codex"), { recursive: true });
  writeFileSync(
    join(options.codexHome, "config.toml"),
    '[mcp_servers.shared]\nurl = "https://user.example/private-value"\n'
  );
  writeFileSync(
    join(options.project, ".codex", "config.toml"),
    '[mcp_servers.shared]\nurl = "https://root.example/private-value"\n[mcp_servers.root_only]\ncommand = "node"\n'
  );
  writeFileSync(
    join(nested, ".codex", "config.toml"),
    '[mcp_servers.shared]\nurl = "https://nested.example/private-value"\n[mcp_servers.nested_only]\ncommand = "node"\nenabled = false\n'
  );
  const snapshot = await buildSnapshot(nested, options);
  expect(
    snapshot.mcpServers.map(({ name, scope, availability }) => [
      name,
      scope,
      availability
    ])
  ).toEqual([
    ["shared", "global", "unknown"],
    ["shared", "project", "unknown"],
    ["root_only", "project", "unknown"],
    ["shared", "project", "unknown"],
    ["nested_only", "project", "disabled"]
  ]);
  expect(snapshot.mcpServers[1]?.reason).toContain(
    "higher-priority Codex layer"
  );
  expect(snapshot.mcpServers[3]?.destination).toBe("https://nested.example");
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
  const global = await buildGlobalSnapshot(options);
  expect(global.mcpServers.map(({ name }) => name)).toEqual(["shared"]);
});

it("reports malformed JSON without exposing its content", async () => {
  const options = fixture();
  writeFileSync(
    join(options.project, ".mcp.json"),
    '{"secret":"private-value"'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.mcpServers).toEqual([]);
  expect(
    snapshot.coverage.some((note) => note.includes("Could not read valid JSON"))
  ).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});
