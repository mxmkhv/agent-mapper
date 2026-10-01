import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const checkTimeoutMs = 45000;

function run(root: string, args: string[]): string | undefined {
  const result = spawnSync(args[0] ?? "", args.slice(1), {
    cwd: root,
    encoding: "utf8",
    timeout: checkTimeoutMs
  });
  if (!result.error && result.status === 0) {
    return;
  }
  return (
    result.error?.message ??
    (`${result.stdout}\n${result.stderr}`.trim() ||
      `Check exited with status ${result.status}.`)
  );
}

export function lint(root: string, files: string[]): string | undefined {
  if (files.length === 0) {
    return;
  }
  const binary = join(root, "node_modules/.bin/oxlint");
  if (!existsSync(binary)) {
    return "Oxlint is missing. Run bun install before continuing.";
  }
  return run(root, [
    binary,
    "-c",
    join(root, "oxlint.config.ts"),
    "--deny-warnings",
    "--no-error-on-unmatched-pattern",
    ...files
  ]);
}

export function typecheck(root: string): string | undefined {
  if (!existsSync(join(root, "node_modules/.bin/tsc"))) {
    return "TypeScript is missing. Run bun install before continuing.";
  }
  return run(root, ["bun", "run", "test:ts"]);
}
