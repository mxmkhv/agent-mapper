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
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-agents-"))
  );
  roots.push(home);
  const project = join(home, "app");
  const nested = join(project, "src");
  const codexHome = join(home, ".codex");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(nested);
  mkdirSync(codexHome);
  return { home, project, nested, codexHome };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reads Claude Markdown agents by scope and marks the lower priority name shadowed", async () => {
  const options = fixture();
  const global = join(options.home, ".claude", "agents", "review");
  const project = join(options.project, ".claude", "agents");
  mkdirSync(global, { recursive: true });
  mkdirSync(project, { recursive: true });
  writeFileSync(
    join(global, "reviewer.md"),
    "---\nname: reviewer\ndescription: Review changes\nmodel: sonnet\n---\nsecret-sentinel-global-prompt\n"
  );
  writeFileSync(
    join(project, "reviewer.md"),
    "---\nname: reviewer\ndescription: Review this repo\n---\nsecret-sentinel-project-prompt\n"
  );
  const snapshot = await buildSnapshot(options.nested, options);
  expect(
    snapshot.agents.map(({ name, scope, availability }) => [
      name,
      scope,
      availability
    ])
  ).toEqual([
    ["reviewer", "global", "shadowed"],
    ["reviewer", "project", "configured"]
  ]);
  expect(snapshot.agents[1]).toMatchObject({
    tool: "claude",
    format: "markdown",
    descriptionPresent: true
  });
  expect(JSON.stringify(snapshot)).not.toContain("secret-sentinel");
  const globalSnapshot = await buildGlobalSnapshot(options);
  expect(globalSnapshot.agents.map((agent) => agent.name)).toEqual([
    "reviewer"
  ]);
});

it("reads Codex TOML agents and keeps malformed files visible", async () => {
  const options = fixture();
  mkdirSync(join(options.codexHome, "agents"));
  mkdirSync(join(options.project, ".codex", "agents"), { recursive: true });
  writeFileSync(
    join(options.codexHome, "agents", "researcher.toml"),
    'name = "researcher"\ndescription = "Find docs"\ndeveloper_instructions = """\nsecret-sentinel-instructions\n"""\n'
  );
  writeFileSync(
    join(options.project, ".codex", "agents", "broken.toml"),
    'name = "broken"\ndescription = "Incomplete"\n'
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(
    snapshot.agents.map(({ name, tool, availability }) => [
      name,
      tool,
      availability
    ])
  ).toEqual([
    ["researcher", "codex", "configured"],
    ["broken", "codex", "unknown"]
  ]);
  expect(snapshot.agents[1]?.reason).toContain("developer_instructions");
  expect(JSON.stringify(snapshot)).not.toContain("secret-sentinel");
});

it("keeps Claude files with unsupported frontmatter visible without calling them loadable", async () => {
  const options = fixture();
  const directory = join(options.project, ".claude", "agents");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "notes.md"), "# Notes\nsecret-sentinel-body\n");
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.agents[0]).toMatchObject({
    name: "notes",
    availability: "unknown",
    readState: "readable"
  });
  expect(JSON.stringify(snapshot)).not.toContain("secret-sentinel");
});

it("keeps duplicate Claude names in one scope unresolved", async () => {
  const options = fixture();
  const directory = join(options.home, ".claude", "agents");
  mkdirSync(directory, { recursive: true });
  for (const filename of ["first.md", "second.md"]) {
    writeFileSync(
      join(directory, filename),
      "---\nname: same\ndescription: Review code\n---\nPrivate prompt."
    );
  }
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.agents.map((agent) => agent.availability)).toEqual([
    "unknown",
    "unknown"
  ]);
});
