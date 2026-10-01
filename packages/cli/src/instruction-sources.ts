import { dirname, join, resolve } from "node:path";
import { SourceCollector } from "./source-reader";

function ancestors(path: string): string[] {
  const result: string[] = [];
  let current = resolve(path);
  for (;;) {
    result.unshift(current);
    const parent = dirname(current);
    if (parent === current) {
      return result;
    }
    current = parent;
  }
}

async function scanDirectory(
  collector: SourceCollector,
  options: { directory: string; includeCodex: boolean }
): Promise<void> {
  const { directory, includeCodex } = options;
  const instructionPaths = [
    ["claude", "CLAUDE.md"],
    ["claude", "CLAUDE.local.md"],
    ["claude", ".claude/CLAUDE.md"],
    ["claude", "AGENTS.md"],
    ["claude", ".claude/AGENTS.md"],
    ["codex", "AGENTS.md"],
    ["codex", "AGENTS.override.md"]
  ] as const;
  for (const [tool, name] of instructionPaths) {
    if (tool === "codex" && !includeCodex) {
      continue;
    }
    await collector.add({
      tool,
      kind: "instruction",
      path: join(directory, name),
      scope: "project",
      projectPath: name.startsWith(".claude/") ? directory : undefined
    });
  }
  const skillPaths = [
    ["claude", ".claude/skills"],
    ["codex", ".agents/skills"],
    ["codex", ".codex/skills"]
  ] as const;
  for (const [tool, name] of skillPaths) {
    if (tool === "codex" && !includeCodex) {
      continue;
    }
    await collector.addSkills({
      tool,
      directory: join(directory, name),
      scope: "project",
      projectPath: directory
    });
  }
  await collector.addCommands({
    tool: "claude",
    directory: join(directory, ".claude", "commands"),
    scope: "project",
    projectPath: directory
  });
}

export async function scanGlobal(
  collector: SourceCollector,
  roots: { home: string; claude: string; codex: string }
): Promise<void> {
  await collector.add({
    tool: "claude",
    kind: "instruction",
    path: join(roots.claude, "CLAUDE.md"),
    scope: "global"
  });
  await collector.add({
    tool: "codex",
    kind: "instruction",
    path: join(roots.codex, "AGENTS.md"),
    scope: "global"
  });
  await collector.add({
    tool: "codex",
    kind: "instruction",
    path: join(roots.codex, "AGENTS.override.md"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "claude",
    directory: join(roots.claude, "skills"),
    scope: "global"
  });
  await collector.addCommands({
    tool: "claude",
    directory: join(roots.claude, "commands"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "codex",
    directory: join(roots.codex, "skills"),
    scope: "global"
  });
  await collector.addSkills({
    tool: "codex",
    directory: join(roots.home, ".agents", "skills"),
    scope: "global"
  });
}

export async function scanProjectSources(
  collector: SourceCollector,
  options: { workingDirectory: string; root: string; home: string }
): Promise<void> {
  const gitRoot = options.root === options.home ? undefined : options.root;
  for (const directory of ancestors(options.workingDirectory)) {
    await scanDirectory(collector, {
      directory,
      includeCodex: gitRoot
        ? directory === gitRoot || directory.startsWith(`${gitRoot}/`)
        : directory === options.workingDirectory
    });
  }
}
