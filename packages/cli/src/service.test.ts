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
import { buildGlobalSnapshot, buildSnapshot, createAppServer } from "./service";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("uses the same resolved source data for CLI and web snapshots", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-service-"));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(project);
  writeFileSync(join(project, "AGENTS.md"), "Read these instructions");

  const snapshot = await buildSnapshot(project, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(
    snapshot.items.find(({ entry }) => entry.tool === "codex")
  ).toMatchObject({
    entry: { tool: "codex", kind: "instruction" },
    resolution: { availability: "expected", loading: "startup" }
  });
  expect(JSON.stringify(snapshot)).not.toContain("Read these instructions");
});

it("adds approximate context figures to the shared snapshot without exposing text", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-context-"));
  roots.push(home);
  const project = join(home, "app");
  const skill = join(project, ".agents", "skills", "review", "SKILL.md");
  mkdirSync(join(project, ".agents", "skills", "review"), { recursive: true });
  writeFileSync(join(project, "AGENTS.md"), "Read the private instructions");
  writeFileSync(skill, "---\nname: review\n---\nPrivate skill body");
  const snapshot = await buildSnapshot(project, {
    home,
    codexHome: join(home, ".codex")
  });
  expect(snapshot.context.codex).toMatchObject({
    startup: Math.round("Read the private instructions".length / 4),
    onDemand: Math.round("Private skill body".length / 4)
  });
  expect(snapshot.context.codex.skillMetadata).toBeGreaterThan(0);
  expect(JSON.stringify(snapshot)).not.toContain("Private skill body");
});

it("resolves a Claude command as on-demand content without exporting its body", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-command-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const command = join(project, ".claude", "commands", "review.md");
  mkdirSync(join(project, ".claude", "commands"), { recursive: true });
  writeFileSync(command, "Private command body");
  const snapshot = await buildSnapshot(project, { home });
  expect(
    snapshot.items.find(({ entry }) => entry.path === command)
  ).toMatchObject({
    entry: { kind: "command", name: "review" },
    resolution: { availability: "expected", loading: "agent-selected" }
  });
  expect(snapshot.context.claude.onDemand).toBeGreaterThan(0);
  expect(snapshot.context.claude.startup).toBe(0);
  expect(JSON.stringify(snapshot)).not.toContain("Private command body");
});

it("applies project instructions stored under .claude to the selected folder", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-claude-folder-"))
  );
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".claude"), { recursive: true });
  writeFileSync(join(project, ".claude", "CLAUDE.md"), "Project guidance");
  writeFileSync(join(project, "AGENTS.md"), "Fallback guidance");
  const snapshot = await buildSnapshot(project, {
    home,
    codexHome: join(home, ".codex")
  });
  const claude = snapshot.items.filter(({ entry }) => entry.tool === "claude");
  expect(
    claude.map(({ entry, resolution }) => [entry.path, resolution.availability])
  ).toContainEqual([join(project, ".claude", "CLAUDE.md"), "expected"]);
  expect(
    claude.find(({ entry }) => entry.path === join(project, "AGENTS.md"))
      ?.resolution.availability
  ).toBe("shadowed");
});

it("requires the session token for local inventory access", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-server-"));
  roots.push(home);
  const webRoot = join(home, "web");
  mkdirSync(webRoot);
  writeFileSync(join(webRoot, "index.html"), "<html>app</html>");
  const app = createAppServer({ home, webRoot });
  const address = await app.listen();
  try {
    const base = `http://127.0.0.1:${address.port}`;
    expect(
      (await fetch(`${base}/api/inventory?path=${encodeURIComponent(home)}`))
        .status
    ).toBe(401);
    const allowed = await fetch(
      `${base}/api/inventory?path=${encodeURIComponent(home)}`,
      {
        headers: { authorization: `Bearer ${app.token}` }
      }
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      workingDirectory: realpathSync(home)
    });
  } finally {
    await app.close();
  }
});

it("keeps the global view limited to global sources", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-global-"));
  roots.push(home);
  mkdirSync(join(home, ".codex"));
  writeFileSync(join(home, ".codex", "AGENTS.md"), "Global instructions");
  writeFileSync(join(home, "AGENTS.md"), "Project instructions");

  const snapshot = await buildGlobalSnapshot({ home });
  expect(snapshot.items.map(({ entry }) => entry.path)).toEqual([
    join(home, ".codex", "AGENTS.md")
  ]);
});

it("includes both local managed Claude instruction sources without exposing their text", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-managed-"));
  roots.push(home);
  const project = join(home, "app");
  const managedClaudeDir = join(home, "managed");
  const split = join(managedClaudeDir, "managed-settings.d");
  mkdirSync(project);
  mkdirSync(split, { recursive: true });
  writeFileSync(join(managedClaudeDir, "CLAUDE.md"), "Managed file secret");
  writeFileSync(
    join(managedClaudeDir, "managed-settings.json"),
    JSON.stringify({ claudeMd: "Earlier inline secret" })
  );
  writeFileSync(
    join(split, "20-instructions.json"),
    JSON.stringify({ claudeMd: "Final inline secret" })
  );
  const options = { home, managedClaudeDir };
  const snapshot = await buildSnapshot(project, options);
  const managed = snapshot.items.filter(
    ({ entry }) => entry.scope === "managed"
  );
  expect(managed).toMatchObject([
    {
      entry: { name: "CLAUDE.md", characters: "Managed file secret".length },
      resolution: { availability: "expected", loading: "startup" }
    },
    {
      entry: {
        name: "claudeMd",
        locator: "claudeMd",
        inlineContent: true,
        path: join(split, "20-instructions.json"),
        characters: "Final inline secret".length
      },
      resolution: { availability: "expected", loading: "startup" }
    }
  ]);
  expect(snapshot.context.claude.startup).toBe(
    Math.round("Managed file secret".length / 4) +
      Math.round("Final inline secret".length / 4)
  );
  expect(JSON.stringify(snapshot)).not.toContain("secret");
  const global = await buildGlobalSnapshot(options);
  expect(
    global.items.filter(({ entry }) => entry.scope === "managed")
  ).toHaveLength(2);
});

it("reports malformed managed settings without treating them as empty policy", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-managed-error-"));
  roots.push(home);
  const managedClaudeDir = join(home, "managed");
  mkdirSync(managedClaudeDir);
  writeFileSync(join(managedClaudeDir, "managed-settings.json"), "{");

  const snapshot = await buildSnapshot(home, { home, managedClaudeDir });
  expect(snapshot.coverage).toContain(
    `${join(managedClaudeDir, "managed-settings.json")}: Managed settings JSON could not be parsed.`
  );
  expect(snapshot.items.some(({ entry }) => entry.name === "claudeMd")).toBe(
    false
  );
});

it("explains how to recover from a missing folder", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-missing-"));
  roots.push(home);
  await expect(buildSnapshot(join(home, "gone"), { home })).rejects.toThrow(
    "Choose an existing folder."
  );
});
