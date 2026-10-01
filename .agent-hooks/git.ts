import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Git could not inspect ${cwd}: ${result.error?.message ?? result.stderr.trim()} Check Git and the working directory.`
    );
  }
  return result.stdout;
}

export function repository(cwd: string): string {
  return git(cwd, ["rev-parse", "--show-toplevel"]).trim();
}

export function changedPaths(root: string): string[] {
  const head = spawnSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"], {
    encoding: "utf8"
  });
  if (head.error) {
    throw head.error;
  }
  const tracked =
    head.status === 0
      ? git(root, ["diff", "--name-only", "-z", "HEAD"])
      : git(root, ["ls-files", "--cached", "-z"]);
  const untracked = git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z"
  ]);
  return [...new Set(`${tracked}${untracked}`.split("\0").filter(Boolean))];
}

export function sourceFiles(root: string, paths: string[]): string[] {
  return [...new Set(paths.map((path) => resolve(root, path)))].filter(
    (path) => {
      if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(path) || !existsSync(path)) {
        return false;
      }
      const rel = relative(realpathSync(root), realpathSync(path));
      return (
        !rel.startsWith("..") && !isAbsolute(rel) && statSync(path).isFile()
      );
    }
  );
}
