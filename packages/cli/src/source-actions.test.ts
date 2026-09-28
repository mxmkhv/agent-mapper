import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { InventorySnapshot } from "@agent-mapper/core";
import { createAppServer } from "./server";
import { openArguments } from "./source-actions";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("only opens regular text files and reveals executable or linked sources", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-open-")));
  roots.push(root);
  const text = join(root, "instructions.md");
  const command = join(root, "hook.command");
  const linked = join(root, "linked.md");
  const app = join(root, "Tool.app");
  writeFileSync(text, "Read this");
  writeFileSync(command, "echo unsafe");
  symlinkSync(command, linked);
  mkdirSync(app);
  expect(await openArguments("open", text)).toEqual([text]);
  expect(await openArguments("open", command)).toEqual(["-R", command]);
  expect(await openArguments("open", linked)).toEqual(["-R", linked]);
  expect(await openArguments("open", app)).toEqual(["-R", app]);
  expect(await openArguments("reveal", text)).toEqual(["-R", text]);
});

it("uses the last inventory's source index without rescanning on a source action", async () => {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-actions-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const webRoot = join(home, "web");
  mkdirSync(project);
  mkdirSync(webRoot);
  writeFileSync(join(project, "AGENTS.md"), "Instructions");
  writeFileSync(join(webRoot, "index.html"), "<html>app</html>");
  const calls: string[][] = [];
  const app = createAppServer({
    home,
    codexHome: join(home, ".codex"),
    webRoot,
    launchSource: async (args) => {
      calls.push(args);
    }
  });
  const address = await app.listen();
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${app.token}` };
  try {
    const before = await fetch(
      `${base}/api/inventory?path=${encodeURIComponent(project)}`,
      { headers }
    );
    expect(before.status).toBe(200);
    const snapshot = (await before.json()) as InventorySnapshot;
    const source = snapshot.items.find(
      (item) => item.entry.path === join(project, "AGENTS.md")
    );
    expect(source).toBeDefined();
    rmSync(project, { recursive: true, force: true });
    const action = await fetch(`${base}/api/source-action`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        path: snapshot.workingDirectory,
        id: source?.entry.id,
        action: "reveal"
      })
    });
    expect(action.status).toBe(200);
    expect(calls).toEqual([["-R", join(project, "AGENTS.md")]]);
  } finally {
    await app.close();
  }
});
