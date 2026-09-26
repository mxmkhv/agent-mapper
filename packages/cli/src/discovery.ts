import { lstat, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { WorktreeRecord } from "@agent-mapper/core";
import { readWorktrees } from "./worktree-git";

const discoveryNames = new Set([
  ".claude",
  ".codex",
  ".agents",
  "CLAUDE.md",
  "CLAUDE.local.md",
  "AGENTS.md",
  "AGENTS.override.md",
  ".mcp.json"
]);
const excludedDirectories = [
  "node_modules",
  ".git",
  "Library",
  "Pods",
  "DerivedData",
  "build",
  "dist",
  ".next",
  ".expo"
];
const exclusions = new Set(excludedDirectories);
const defaultDepth = 6;
interface VisitCandidate {
  directory: string;
  name: string;
  depth: number;
}
interface DiscoveredProject {
  path: string;
  hits: string[];
  worktrees?: WorktreeRecord[];
}

async function groupWorktrees(projects: DiscoveredProject[]): Promise<{
  projects: DiscoveredProject[];
  errors: string[];
}> {
  const scanned = await Promise.all(
    projects.map((project) => readWorktrees(project.path))
  );
  const grouped = new Map<string, DiscoveredProject>();
  const errors: string[] = [];
  for (const [index, project] of projects.entries()) {
    const result = scanned[index];
    errors.push(...(result?.errors ?? []));
    const worktrees = result?.worktrees ?? [];
    const main = worktrees.find((item) => item.isMain);
    const key = main?.path ?? project.path;
    const previous = grouped.get(key);
    grouped.set(key, {
      path: key,
      hits: [...(previous?.hits ?? []), ...project.hits],
      worktrees: main ? worktrees : undefined
    });
  }
  return {
    projects: [...grouped.values()].sort((a, b) =>
      a.path.localeCompare(b.path)
    ),
    errors
  };
}
export interface DiscoveryResult {
  projects: DiscoveredProject[];
  errors: string[];
  exclusions: string[];
  maxDepth: number;
}

class DiscoveryWalk {
  readonly projects = new Map<string, string[]>();
  readonly errors: string[] = [];
  constructor(
    readonly root: string,
    readonly maxDepth: number
  ) {}

  private async recordHit(directory: string, path: string): Promise<void> {
    if (directory === this.root) {
      return;
    }
    const project = (await findGitRoot(directory, this.root)) ?? directory;
    this.projects.set(project, [...(this.projects.get(project) ?? []), path]);
  }

  private shouldVisit(candidate: VisitCandidate): boolean {
    return (
      candidate.depth < this.maxDepth &&
      !exclusions.has(candidate.name) &&
      !(candidate.directory === this.root && candidate.name.startsWith("."))
    );
  }

  async visit(directory: string, depth: number): Promise<void> {
    let items;
    try {
      items = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      this.errors.push(
        `${directory}: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    for (const item of items) {
      const path = join(directory, item.name);
      if (discoveryNames.has(item.name)) {
        await this.recordHit(directory, path);
        if (item.isDirectory() || item.isSymbolicLink()) {
          continue;
        }
      }
      if (
        item.isDirectory() &&
        this.shouldVisit({ directory, name: item.name, depth })
      ) {
        await this.visit(path, depth + 1);
      }
    }
  }
}

export async function discoverProjects(
  home = homedir(),
  maxDepth = defaultDepth
): Promise<DiscoveryResult> {
  const walk = new DiscoveryWalk(resolve(home), maxDepth);
  await walk.visit(walk.root, 0);
  const grouped = await groupWorktrees(
    [...walk.projects].map(([path, hits]) => ({ path, hits }))
  );
  return {
    projects: grouped.projects,
    errors: [...walk.errors, ...grouped.errors],
    exclusions: excludedDirectories,
    maxDepth
  };
}

export async function findGitRoot(
  directory: string,
  stop: string
): Promise<string | undefined> {
  let current = directory;
  while (current.startsWith(stop)) {
    try {
      await lstat(join(current, ".git"));
      return current;
    } catch {
      if (current === stop) {
        break;
      }
      current = dirname(current);
    }
  }
  return undefined;
}
