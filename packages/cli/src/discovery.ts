import { lstat, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import type { WorktreeRecord } from "@agent-mapper/core";
import { readWorktrees } from "./worktree-git";
import { boundedMap } from "./bounded-map";

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
const maxConcurrentGitScans = 8;
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

async function groupWorktrees(
  projects: DiscoveredProject[],
  home: string
): Promise<{
  projects: DiscoveredProject[];
  errors: string[];
}> {
  const scanned = await boundedMap(projects, {
    limit: maxConcurrentGitScans,
    task: (project) => readWorktrees(project.path)
  });
  const grouped = new Map<string, DiscoveredProject>();
  const errors: string[] = [];
  for (const [index, project] of projects.entries()) {
    const result = scanned[index];
    errors.push(...(result?.errors ?? []));
    const worktrees = result?.worktrees ?? [];
    const main = worktrees.find((item) => item.isMain);
    let key = main?.path ?? project.path;
    if (key === home) {
      key = project.path;
    }
    const groupedWorktrees = main && main.path !== home ? worktrees : undefined;
    const previous = grouped.get(key);
    grouped.set(key, {
      path: key,
      hits: [...(previous?.hits ?? []), ...project.hits].sort(),
      worktrees: groupedWorktrees
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
  readonly gitRoots = new Map<string, Promise<string | undefined>>();
  constructor(
    readonly root: string,
    readonly maxDepth: number
  ) {}

  private async recordHit(directory: string, path: string): Promise<void> {
    if (directory === this.root) {
      return;
    }
    const gitRoot = await findGitRoot(directory, {
      stop: this.root,
      errors: this.errors,
      cache: this.gitRoots
    });
    const project = gitRoot === this.root ? directory : (gitRoot ?? directory);
    this.projects.set(project, [...(this.projects.get(project) ?? []), path]);
  }

  private shouldVisit(candidate: VisitCandidate): boolean {
    return (
      candidate.depth < this.maxDepth &&
      !exclusions.has(candidate.name) &&
      !(candidate.directory === this.root && candidate.name.startsWith("."))
    );
  }

  async visit(directory: string, depth: number): Promise<string[]> {
    const next: string[] = [];
    let items;
    try {
      items = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      this.errors.push(
        `${directory}: ${error instanceof Error ? error.message : String(error)}`
      );
      return next;
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
        next.push(path);
      }
    }
    return next;
  }
}

export async function discoverProjects(
  home = homedir(),
  maxDepth = defaultDepth
): Promise<DiscoveryResult> {
  const walk = new DiscoveryWalk(resolve(home), maxDepth);
  let directories = [walk.root];
  for (let depth = 0; depth <= maxDepth && directories.length; depth += 1) {
    const children = await boundedMap(directories, {
      limit: maxConcurrentGitScans,
      task: (directory) => walk.visit(directory, depth)
    });
    directories = children.flat();
  }
  const grouped = await groupWorktrees(
    [...walk.projects].map(([path, hits]) => ({ path, hits })),
    walk.root
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
  options: {
    stop: string;
    errors?: string[];
    cache?: Map<string, Promise<string | undefined>>;
  }
): Promise<string | undefined> {
  const { stop, errors, cache } = options;
  const prefix = stop === sep ? stop : `${stop}${sep}`;
  const lookup = (current: string): Promise<string | undefined> => {
    if (current !== stop && !current.startsWith(prefix)) {
      return Promise.resolve(undefined);
    }
    const cached = cache?.get(current);
    if (cached) {
      return cached;
    }
    const pending = (async () => {
      try {
        await lstat(join(current, ".git"));
        return current;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ENOTDIR") {
          const message = `${join(current, ".git")}: Could not inspect Git root. Check permissions.`;
          if (errors) {
            errors.push(message);
            return undefined;
          }
          throw new Error(message, { cause: error });
        }
        return current === stop ? undefined : lookup(dirname(current));
      }
    })();
    cache?.set(current, pending);
    return pending;
  };
  return lookup(directory);
}
