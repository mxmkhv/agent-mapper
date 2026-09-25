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

it("explains how to recover from a missing folder", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-missing-"));
  roots.push(home);
  await expect(buildSnapshot(join(home, "gone"), { home })).rejects.toThrow(
    "Choose an existing folder."
  );
});
