import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ConfigStore } from "./app-config";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    chmodSync(root, 0o700);
    rmSync(root, { recursive: true, force: true });
  }
});

function store() {
  const root = mkdtempSync(join(tmpdir(), "agent-mapper-config-"));
  roots.push(root);
  const path = join(root, "agent-mapper", "config.json");
  return { root, path, config: new ConfigStore(path) };
}

it("keeps both of two removals sent at the same time", async () => {
  const { path, config } = store();
  await Promise.all([
    config.setHidden("/b", true),
    config.setHidden("/a/", true)
  ]);
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
    version: 1,
    hiddenProjects: ["/a", "/b"]
  });
});

it("recovers after a failed save", async () => {
  const { root, path, config } = store();
  chmodSync(root, 0o500);
  await expect(config.setHidden("/a", true)).rejects.toThrow(
    /^Could not save .*config\.json \(EACCES\)\. Check that the folder is writable, then try again\.$/
  );
  chmodSync(root, 0o700);
  await config.setHidden("/b", true);
  expect((await config.read()).hiddenProjects).toEqual(["/b"]);
  expect(readFileSync(path, "utf8")).toContain('"/b"');
});

it("refuses to treat an unexpected file as empty", async () => {
  const { path, config } = store();
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "[]");
  await expect(config.setHidden("/a", true)).rejects.toThrow(
    `${path} must contain a JSON object. Fix or delete it, then rescan.`
  );
  writeFileSync(path, '{"version":2,"hiddenProjects":[],"pinned":["/x"]}');
  await expect(config.read()).rejects.toThrow(
    `${path} was written by a newer agent-mapper (version 2). Update agent-mapper, or delete the file.`
  );
  expect(readFileSync(path, "utf8")).toContain("pinned");
});
