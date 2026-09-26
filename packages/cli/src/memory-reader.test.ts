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
import { buildGlobalSnapshot, buildSnapshot } from "./service";

const roots: string[] = [];
function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-memory-"))
  );
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

function writeMemorySources(options: ReturnType<typeof fixture>): void {
  const encoded = options.project.replace(/[^A-Za-z0-9]/g, "-");
  const claude = join(options.home, ".claude", "projects", encoded, "memory");
  mkdirSync(claude, { recursive: true });
  writeFileSync(
    join(claude, "MEMORY.md"),
    "secret-sentinel-memory\nsecond line\n"
  );
  writeFileSync(join(claude, "topic.md"), "secret-sentinel-topic");
  mkdirSync(join(options.codexHome, "memories", "notes"), { recursive: true });
  writeFileSync(
    join(options.codexHome, "memories", "notes", "global.md"),
    "secret-sentinel-codex"
  );
  mkdirSync(join(options.project, ".agents"));
  writeFileSync(
    join(options.project, ".agents", "MEMORY.md"),
    "secret-sentinel-agent"
  );
}

it("lists memory metadata without exporting content or claiming a Claude project match", async () => {
  const options = fixture();
  writeMemorySources(options);
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.memories.map(({ tool, name, scope, projectMatch }) => [
      tool,
      name,
      scope,
      projectMatch
    ])
  ).toEqual([
    ["codex", "global.md", "global", "not applicable"],
    ["claude", "MEMORY.md", "project", "candidate"],
    ["claude", "topic.md", "project", "candidate"],
    ["unknown", "MEMORY.md", "project", "matched"]
  ]);
  expect(
    snapshot.memories.find(
      (item) => item.tool === "claude" && item.name === "MEMORY.md"
    )
  ).toMatchObject({
    sizeBytes: Buffer.byteLength("secret-sentinel-memory\nsecond line\n"),
    lineCount: 2,
    loading: "startup index"
  });
  expect(
    snapshot.memories.every(
      (item) => !Number.isNaN(Date.parse(item.modifiedAt))
    )
  ).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain("secret-sentinel-");
});

it("shows unassigned Claude directories in global view without assigning a project", async () => {
  const options = fixture();
  writeMemorySources(options);
  const global = await buildGlobalSnapshot(options);
  expect(
    global.memories.map(({ tool, projectMatch }) => [tool, projectMatch])
  ).toEqual([
    ["codex", "not applicable"],
    ["claude", "unmatched"],
    ["claude", "unmatched"]
  ]);
  expect(global.memories.every((item) => item.scope !== "project")).toBe(true);
});

it("keeps global memory scope when the home path is a symlink", async () => {
  const options = fixture();
  writeMemorySources(options);
  const alias = join(options.home, "home-link");
  symlinkSync(options.home, alias);
  const global = await buildGlobalSnapshot({
    home: alias,
    codexHome: options.codexHome
  });
  expect(global.memories.filter((item) => item.tool === "claude")).toHaveLength(
    2
  );
  expect(
    global.memories.find((item) => item.tool === "claude")?.projectMatch
  ).toBe("unmatched");
});

it("keeps a broken memory link visible with an actionable read state", async () => {
  const options = fixture();
  mkdirSync(join(options.codexHome, "memories"));
  symlinkSync(
    join(options.home, "missing.md"),
    join(options.codexHome, "memories", "broken.md")
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.memories[0]).toMatchObject({
    name: "broken.md",
    readState: "unreadable"
  });
  expect(snapshot.memories[0]?.error).toContain("Open the source");
});
