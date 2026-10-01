import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildGlobalSnapshot, buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-managed-mcp-"));
  roots.push(home);
  const project = join(home, "app");
  const managedClaudeDir = join(home, "managed");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(managedClaudeDir);
  return { home, project, managedClaudeDir };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("inventories exclusive managed servers and redacts their secrets", async () => {
  const options = fixture();
  writeFileSync(
    join(options.home, ".claude.json"),
    JSON.stringify({ mcpServers: { ordinary: { command: "node" } } })
  );
  writeFileSync(
    join(options.managedClaudeDir, "managed-mcp.json"),
    JSON.stringify({
      mcpServers: {
        private: {
          type: "streamable-http",
          url: "https://user:private-value@example.com/secret",
          headers: { Authorization: "private-value" }
        }
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.mcpServers.map(({ name, scope, availability }) => [
      name,
      scope,
      availability
    ])
  ).toEqual([
    ["ordinary", "global", "shadowed"],
    ["private", "managed", "unknown"]
  ]);
  expect(snapshot.mcpServers[1]).toMatchObject({
    locator: "mcpServers.private",
    transport: "http",
    destination: "https://example.com",
    headerNames: ["Authorization"]
  });
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
  const global = await buildGlobalSnapshot(options);
  expect(global.mcpServers.map(({ scope }) => scope)).toEqual([
    "global",
    "managed"
  ]);
});

it("treats an empty managed MCP map as exclusive", async () => {
  const options = fixture();
  writeFileSync(
    join(options.home, ".claude.json"),
    JSON.stringify({ mcpServers: { ordinary: { command: "node" } } })
  );
  writeFileSync(
    join(options.managedClaudeDir, "managed-mcp.json"),
    JSON.stringify({ mcpServers: {} })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.mcpServers).toMatchObject([
    { name: "ordinary", availability: "shadowed" }
  ]);
});

it("tracks provided servers through ordered settings and name collisions", async () => {
  const options = fixture();
  const base = join(options.managedClaudeDir, "managed-settings.json");
  const split = join(options.managedClaudeDir, "managed-settings.d");
  mkdirSync(split);
  writeFileSync(
    join(options.home, ".claude.json"),
    JSON.stringify({ mcpServers: { shared: { command: "node" } } })
  );
  writeFileSync(
    base,
    JSON.stringify({
      managedMcpServers: {
        shared: { type: "http", url: "https://first.example/secret" }
      }
    })
  );
  writeFileSync(
    join(split, "20-next.json"),
    JSON.stringify({
      managedMcpServers: {
        shared: { type: "sse", url: "https://second.example/private-value" },
        extra: { type: "http", url: "https://extra.example/private-value" }
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.mcpServers.map(({ name, availability }) => [name, availability])
  ).toEqual([
    ["shared", "unknown"],
    ["shared", "shadowed"],
    ["shared", "unknown"],
    ["extra", "unknown"]
  ]);
  expect(snapshot.mcpServers[2]).toMatchObject({
    sourcePath: join(split, "20-next.json"),
    locator: "managedMcpServers.shared",
    destination: "https://second.example"
  });
  expect(snapshot.mcpServers[1]?.shadowedBy).toBe(snapshot.mcpServers[2]?.id);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("does not apply exclusion from malformed managed MCP files", async () => {
  const options = fixture();
  const path = join(options.managedClaudeDir, "managed-mcp.json");
  writeFileSync(
    join(options.home, ".claude.json"),
    JSON.stringify({ mcpServers: { ordinary: { command: "node" } } })
  );
  writeFileSync(path, JSON.stringify({ mcpServers: "private-value" }));
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.mcpServers[0]?.availability).toBe("configured");
  expect(snapshot.coverage).toContain(`${path}: mcpServers must be an object.`);
  expect(JSON.stringify(snapshot)).not.toContain("private-value");
});

it("links a provided server to the exclusive declaration that replaces it", async () => {
  const options = fixture();
  writeFileSync(
    join(options.managedClaudeDir, "managed-settings.json"),
    JSON.stringify({
      managedMcpServers: { shared: { type: "http", url: "https://a.example" } }
    })
  );
  writeFileSync(
    join(options.managedClaudeDir, "managed-mcp.json"),
    JSON.stringify({
      mcpServers: { shared: { type: "http", url: "https://b.example" } }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  const [provided, exclusive] = snapshot.mcpServers;
  expect(provided?.availability).toBe("shadowed");
  expect(provided?.shadowedBy).toBe(exclusive?.id);
});
