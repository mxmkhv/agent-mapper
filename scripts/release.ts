import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const releaseTypes = ["patch", "minor", "major"] as const;
type ReleaseType = (typeof releaseTypes)[number];

const root = resolve(import.meta.dirname, "..");
const manifestPath = "packages/cli/package.json";

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
}

function runVisible(command: string, args: string[]): void {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

function parseReleaseType(value: string | undefined): ReleaseType {
  const match = releaseTypes.find((type) => type === value);
  if (!match) {
    throw new Error(`Usage: bun run release:<${releaseTypes.join("|")}>`);
  }
  return match;
}

function bumpVersion(version: string, type: ReleaseType): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(
      `${manifestPath} has version "${version}"; expected major.minor.patch.`
    );
  }
  const [major, minor, patch] = match.slice(1).map(Number) as [
    number,
    number,
    number
  ];
  if (type === "major") {
    return `${major + 1}.0.0`;
  }
  if (type === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function fetchReleasableDev(): void {
  if (run("git", ["status", "--porcelain"])) {
    throw new Error(
      "The working tree has changes. Commit or set them aside first; the release branch starts from origin/dev."
    );
  }
  run("git", ["fetch", "origin", "dev", "main", "--tags"]);
  try {
    run("git", ["merge-base", "--is-ancestor", "origin/main", "origin/dev"]);
  } catch (error: unknown) {
    // Exit status 1 means "not an ancestor"; anything else is a real Git failure.
    if ((error as { status?: number }).status !== 1) {
      throw error;
    }
    throw new Error(
      "origin/dev is missing commits from origin/main. Merge main into dev, then release again."
    );
  }
}

function readDevVersion(): string {
  const manifest = JSON.parse(
    run("git", ["show", `origin/dev:${manifestPath}`])
  ) as { version: string };
  return manifest.version;
}

function releaseBranch(version: string): string {
  return `release/${version}`;
}

function assertBranchIsFree(version: string): void {
  const branch = releaseBranch(version);
  const local = run("git", ["branch", "--list", branch]);
  const remote = run("git", ["ls-remote", "--heads", "origin", branch]);
  if (local || remote) {
    throw new Error(
      `${branch} already exists from an earlier run. Finish it with \`gh pr create --base main --head ${branch}\`, or delete it (\`git branch -D ${branch}\` and \`git push origin --delete ${branch}\`) and release again.`
    );
  }
}

function commitVersion(version: string): void {
  run("git", ["switch", "--create", releaseBranch(version), "origin/dev"]);
  const manifestFile = resolve(root, manifestPath);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as Record<
    string,
    unknown
  >;
  manifest.version = version;
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  run("git", ["add", manifestPath]);
  runVisible("git", ["commit", "--message", `chore: release ${version}`]);
}

function openReleasePullRequest(version: string, type: ReleaseType): string {
  const changes = run("git", [
    "log",
    "--no-merges",
    "--format=- %s",
    "origin/main..origin/dev"
  ]);
  const body = [
    `Releases agent-mapper ${version} (${type}).`,
    `Merge with **Create a merge commit**, not squash or rebase. Merging publishes to npm, creates the \`v${version}\` GitHub release, and merges \`main\` back into \`dev\`.`,
    "## Changes since the last release",
    changes || "- Version bump only"
  ].join("\n\n");
  return run("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    releaseBranch(version),
    "--title",
    `chore: release ${version}`,
    "--body",
    body
  ]);
}

function main(): void {
  const type = parseReleaseType(process.argv[2]);
  fetchReleasableDev();

  const current = readDevVersion();
  const next = bumpVersion(current, type);
  if (run("git", ["tag", "--list", `v${next}`])) {
    throw new Error(
      `Tag v${next} already exists, but dev is at ${current}. Set packages/cli/package.json on dev to the latest released version, then release again.`
    );
  }
  assertBranchIsFree(next);

  console.log(`Releasing agent-mapper ${current} → ${next}`);
  commitVersion(next);
  console.log("Pushing; the pre-push hook runs the full validate…");
  runVisible("git", ["push", "--set-upstream", "origin", releaseBranch(next)]);
  console.log(
    `Release PR: ${openReleasePullRequest(next, type)}\nMerge it to publish.`
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `release: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
