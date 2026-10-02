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
import type { DesktopRequest } from "./desktop";
import { createAppServer } from "./service";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("keeps home project source actions after a global scan", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-home-action-"))
  );
  roots.push(home);
  const webRoot = join(home, "web");
  mkdirSync(webRoot);
  mkdirSync(join(home, ".codex"));
  writeFileSync(join(home, "AGENTS.md"), "Home project instructions");
  writeFileSync(join(home, ".codex", "AGENTS.md"), "Global instructions");
  const launched: DesktopRequest[] = [];
  const app = createAppServer({
    home,
    webRoot,
    desktop: async (request) => {
      launched.push(request);
    }
  });
  const address = await app.listen();
  try {
    const base = `http://127.0.0.1:${address.port}`;
    const headers = { authorization: `Bearer ${app.token}` };
    const projectResponse = await fetch(
      `${base}/api/inventory?path=${encodeURIComponent(home)}`,
      { headers }
    );
    const project = (await projectResponse.json()) as {
      items: { entry: { id: string; path: string } }[];
    };
    const source = project.items.find(
      ({ entry }) => entry.path === join(home, "AGENTS.md")
    );
    expect(source).toBeDefined();
    expect(
      (await fetch(`${base}/api/inventory?scope=global`, { headers })).status
    ).toBe(200);
    const action = await fetch(`${base}/api/source-action`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ path: home, id: source?.entry.id, action: "open" })
    });
    expect(action.status).toBe(200);
    expect(launched).toEqual([
      { action: "open", path: join(home, "AGENTS.md") }
    ]);
  } finally {
    await app.close();
  }
});

it("tells the UI which platform's file manager wording to use", async () => {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-host-")));
  roots.push(home);
  const webRoot = join(home, "web");
  mkdirSync(webRoot);
  const host = async (platform: NodeJS.Platform) => {
    const app = createAppServer({ home, webRoot, platform });
    const address = await app.listen();
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/host`,
        {
          headers: { authorization: `Bearer ${app.token}` }
        }
      );
      return await response.json();
    } finally {
      await app.close();
    }
  };
  expect(await host("darwin")).toEqual({ platform: "macos" });
  expect(await host("linux")).toEqual({ platform: "linux" });
  expect(await host("win32")).toEqual({ platform: "other" });
});
