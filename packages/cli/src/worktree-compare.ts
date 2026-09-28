import { createHash } from "node:crypto";
import type {
  ComparisonSide,
  WorktreeComparison,
  WorktreeDifference,
  WorktreeRecord
} from "@agent-mapper/core";
import { configFiles, type ConfigFile } from "./worktree-files";
import { readWorktrees, trackedFiles } from "./worktree-git";

const idLength = 20;

function id(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, idLength);
}

function side(
  file: ConfigFile,
  tracked: Set<string> | undefined
): ComparisonSide {
  let tracking: ComparisonSide["tracking"] = "unknown";
  if (tracked) {
    tracking = tracked.has(file.relativePath) ? "tracked" : "not tracked";
  }
  return {
    id: id(file.path),
    path: file.path,
    tracking,
    readState: file.readState
  };
}

function difference(
  files: { main?: ConfigFile; here?: ConfigFile },
  options: {
    mainTracked?: Set<string>;
    hereTracked?: Set<string>;
    mainPath: string;
    herePath: string;
  }
): WorktreeDifference | undefined {
  const { main, here } = files;
  const file = main ?? here;
  if (!file) {
    return undefined;
  }
  if (
    main &&
    here &&
    main.fingerprint === here.fingerprint &&
    main.readState === "readable" &&
    here.readState === "readable"
  ) {
    return undefined;
  }
  let state: WorktreeDifference["state"] = "unknown";
  if (!main) {
    state = "only-here";
  } else if (!here) {
    state = "only-main";
  } else if (main.readState === "readable" && here.readState === "readable") {
    state = "different-content";
  }
  return {
    id: id(`${options.mainPath}:${options.herePath}:${file.relativePath}`),
    relativePath: file.relativePath,
    kind: file.kind,
    tool: file.tool,
    state,
    main: main ? side(main, options.mainTracked) : undefined,
    here: here ? side(here, options.hereTracked) : undefined
  };
}

async function compare(
  mainPath: string,
  herePath: string
): Promise<{
  comparison: WorktreeComparison;
  errors: string[];
}> {
  const [main, here, mainTracked, hereTracked] = await Promise.all([
    configFiles(mainPath),
    configFiles(herePath),
    trackedFiles(mainPath),
    trackedFiles(herePath)
  ]);
  const paths = new Set([...main.files.keys(), ...here.files.keys()]);
  const differences = [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) =>
      difference(
        {
          main: main.files.get(relativePath),
          here: here.files.get(relativePath)
        },
        { mainTracked, hereTracked, mainPath, herePath }
      )
    )
    .filter((item): item is WorktreeDifference => Boolean(item));
  return {
    comparison: { mainPath, herePath, differences },
    errors: [...main.errors, ...here.errors]
  };
}

export async function scanWorktrees(directory: string): Promise<{
  worktrees: WorktreeRecord[];
  comparison?: WorktreeComparison;
  errors: string[];
}> {
  const git = await readWorktrees(directory);
  const main = git.worktrees.find((item) => item.isMain);
  if (!main || !git.selectedRoot || git.selectedRoot === main.path) {
    return { worktrees: git.worktrees, errors: git.errors };
  }
  if (main.state !== "available") {
    return {
      worktrees: git.worktrees,
      errors: [
        ...git.errors,
        `${main.path}: The main checkout is unavailable. Restore it or run git worktree repair before comparing configuration.`
      ]
    };
  }
  const result = await compare(main.path, git.selectedRoot);
  return {
    worktrees: git.worktrees,
    comparison: result.comparison,
    errors: [...git.errors, ...result.errors]
  };
}
