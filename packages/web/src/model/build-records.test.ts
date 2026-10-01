import { expect, it } from "vitest";
import type {
  InventorySnapshot,
  PluginRecord,
  ResolvedEntry
} from "@agent-mapper/core";
import { buildRecords } from "./build-records";
import { layerHint } from "./layers";
import { isLink, linkedFrom, linkTarget } from "./links";
import { pathContext, shortPath } from "./paths";
import { stateLabel, stateText } from "./states";

const home = "/Users/dev";
const repo = `${home}/code/app`;

function entry(
  input: Partial<ResolvedEntry["entry"]> & { id: string; path: string }
): ResolvedEntry {
  return {
    entry: {
      tool: "claude",
      kind: "instruction",
      name: input.path.split("/").at(-1) ?? input.id,
      scope: "project",
      readState: "readable",
      isSymlink: false,
      ...input
    },
    resolution: {
      availability: "expected",
      loading: "startup",
      reason: "Fixture"
    }
  };
}

function plugin(id: string, state: PluginRecord["state"]): PluginRecord {
  return {
    id,
    tool: "claude",
    key: `${id}@market`,
    name: id,
    version: "1.0.0",
    scope: "global",
    state,
    reason: "Fixture",
    installPath: `${home}/.claude/plugins/cache/${id}`,
    sourcePath: `${home}/.claude/plugins/cache/${id}/plugin.json`,
    contributions: [
      { kind: "skill", name: "review", sourcePath: "skills/review/SKILL.md" }
    ]
  };
}

function snapshot(parts: Partial<InventorySnapshot>): InventorySnapshot {
  return {
    workingDirectory: repo,
    scannedAt: "2026-09-28T10:00:00.000Z",
    roots: { claude: `${home}/.claude`, codex: `${home}/.codex` },
    items: [],
    imports: [],
    plugins: [],
    hooks: [],
    mcpServers: [],
    memories: [],
    agents: [],
    context: {
      claude: {
        startup: 0,
        skillMetadata: 0,
        onDemand: 0,
        unaccountedSources: 0
      },
      codex: {
        startup: 0,
        skillMetadata: 0,
        onDemand: 0,
        unaccountedSources: 0
      }
    },
    findings: [],
    worktrees: [],
    coverage: [],
    ...parts
  };
}

it("assigns layers, including personal .local files", () => {
  const records = buildRecords(
    snapshot({
      items: [
        entry({
          id: "global",
          path: `${home}/.claude/CLAUDE.md`,
          scope: "global"
        }),
        entry({ id: "project", path: `${repo}/CLAUDE.md` }),
        entry({ id: "local", path: `${repo}/CLAUDE.local.md` })
      ]
    }),
    "project"
  );
  expect(records.map((record) => record.layer)).toEqual([
    "global",
    "project",
    "user"
  ]);
});

it("marks everything from a cached plugin version as inactive", () => {
  const skill = entry({
    id: "skill",
    kind: "skill",
    path: `${home}/.claude/plugins/cache/old/skills/review/SKILL.md`,
    scope: "global",
    pluginId: "old"
  });
  const [record, pluginRecord] = buildRecords(
    snapshot({ items: [skill], plugins: [plugin("old", "cached")] }),
    "global"
  );
  expect(record).toMatchObject({
    tier: "inactive",
    layer: "plugins",
    pluginPath: "skills/review/SKILL.md"
  });
  expect(record && stateLabel(record)).toBe("cached version");
  expect(pluginRecord?.contributions).toEqual({ skill: 1 });
});

it("keeps active records quiet and names shadowed ones plainly", () => {
  const shadowed = entry({ id: "agents", path: `${repo}/AGENTS.md` });
  shadowed.resolution = {
    availability: "shadowed",
    loading: "not-applicable",
    reason: "CLAUDE.md wins"
  };
  const [active, inactive] = buildRecords(
    snapshot({
      items: [entry({ id: "claude", path: `${repo}/CLAUDE.md` }), shadowed]
    }),
    "project"
  );
  expect(active && stateLabel(active)).toBeUndefined();
  expect(active && stateText(active)).toBe("Loads at startup");
  expect(inactive && stateText(inactive)).toBe("Not used here");
});

it("links symlinks and their sources in both directions", () => {
  const records = buildRecords(
    snapshot({
      items: [
        entry({
          id: "source",
          path: `${home}/.claude/CLAUDE.md`,
          scope: "global"
        }),
        entry({
          id: "link",
          tool: "codex",
          path: `${home}/.codex/AGENTS.md`,
          realPath: `${home}/.claude/CLAUDE.md`,
          scope: "global"
        })
      ]
    }),
    "global"
  );
  const [source, link] = records;
  expect(source && isLink(source)).toBe(false);
  expect(link && linkTarget(link, records)?.id).toBe("source");
  expect(source && linkedFrom(source, records).map((item) => item.id)).toEqual([
    "link"
  ]);
});

it("describes where each layer lives for the selected tool", () => {
  const data = snapshot({
    items: [
      entry({
        id: "g",
        tool: "codex",
        path: `${home}/.agents/skills/x/SKILL.md`,
        scope: "global"
      }),
      entry({ id: "p", path: `${home}/AGENTS.md` })
    ]
  });
  const context = pathContext(data, true);
  const records = buildRecords(data, "project");
  expect(layerHint("global", { records, context, tool: "codex" })).toBe(
    "~/.agents"
  );
  expect(layerHint("project", { records, context, tool: "claude" })).toBe(
    "Repo and parent folders"
  );
  expect(shortPath(`${repo}/.codex/agents/cpo.toml`, context)).toBe(
    ".codex/agents/cpo.toml"
  );
  expect(shortPath(`${home}/.claude/CLAUDE.md`, context)).toBe(
    "~/.claude/CLAUDE.md"
  );
});

it("attaches the owning scan to file-backed instructions and skills only", () => {
  const records = buildRecords(
    snapshot({
      items: [
        entry({ id: "file", path: `${repo}/CLAUDE.md` }),
        entry({
          id: "inline",
          path: `${repo}/settings.json`,
          inlineContent: true
        }),
        entry({ id: "command", kind: "command", path: `${repo}/c.md` })
      ]
    }),
    "project"
  );
  expect(records.map((record) => record.sourceRef)).toEqual([
    { scope: "project", workingDirectory: repo, entryId: "file" },
    undefined,
    undefined
  ]);
});
