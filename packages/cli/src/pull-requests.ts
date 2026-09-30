import { execFile } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  PullRequestLookup,
  PullRequestsByBranch,
  PullRequestSummary
} from "@agent-mapper/core";
import { readWorktrees } from "./worktree-git";

const execute = promisify(execFile);
const ghTimeoutMs = 20_000;
const pullRequestLimit = "200";

/** Runs gh in a folder and resolves its stdout. Injectable so tests never call GitHub. */
export type GhRunner = (directory: string, args: string[]) => Promise<string>;

const runGh: GhRunner = async (directory, args) => {
  const { stdout } = await execute("gh", args, {
    cwd: directory,
    encoding: "utf8",
    timeout: ghTimeoutMs,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" }
  });
  return stdout;
};

const rank = { open: 0, draft: 0, merged: 1, closed: 2 } satisfies Record<
  PullRequestSummary["state"],
  number
>;

function summary(value: unknown): [string, PullRequestSummary] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const item = value as Record<string, unknown>;
  const { headRefName, number, state, isDraft, title, url } = item;
  if (
    typeof headRefName !== "string" ||
    typeof number !== "number" ||
    typeof url !== "string" ||
    !["OPEN", "MERGED", "CLOSED"].includes(String(state))
  ) {
    return undefined;
  }
  const lower = String(state).toLowerCase() as "open" | "merged" | "closed";
  return [
    headRefName,
    {
      number,
      state: lower === "open" && isDraft === true ? "draft" : lower,
      title: typeof title === "string" ? title : "",
      url
    }
  ];
}

/** gh lists newest first; keep the first PR of the best rank per branch. */
function byBranch(output: string): PullRequestsByBranch {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) {
    throw new TypeError("gh returned something other than a list.");
  }
  const result: PullRequestsByBranch = {};
  for (const [branch, pr] of parsed.map(summary).filter((item) => !!item)) {
    const current = result[branch];
    if (!current || rank[pr.state] < rank[current.state]) {
      result[branch] = pr;
    }
  }
  return result;
}

function unavailableReason(error: unknown): string {
  const failure = error as {
    code?: unknown;
    killed?: boolean;
    stderr?: unknown;
  };
  if (failure.code === "ENOENT") {
    return "Install the GitHub CLI (gh) to see pull request status.";
  }
  if (failure.killed) {
    return "GitHub did not answer in time. Rescan to try again.";
  }
  const stderr = typeof failure.stderr === "string" ? failure.stderr : "";
  if (/auth login|not logged in|authentication/i.test(stderr)) {
    return "Run gh auth login to see pull request status.";
  }
  if (/no git remotes|none of the git remotes|not a github/i.test(stderr)) {
    return "This repository has no GitHub remote, so there are no pull requests to show.";
  }
  const line = stderr.trim().split("\n")[0];
  return `gh could not list pull requests${line ? `: ${line}` : ""}. Run gh pr list in the repository to see why.`;
}

/**
 * Asks GitHub, through the user's gh login, for the pull requests of the repository that contains `value`.
 * Read-only. A missing or logged-out gh, or a repository without a GitHub remote, is a reason, not an error.
 */
export async function pullRequests(
  value: string | null,
  run: GhRunner = runGh
): Promise<PullRequestLookup> {
  if (!value || !isAbsolute(value)) {
    throw new Error("Send the repository's absolute folder path.");
  }
  const main = (await readWorktrees(resolve(value))).worktrees.find(
    (tree) => tree.isMain
  );
  if (!main) {
    throw new Error(`${value} is not a Git repository. Rescan to refresh.`);
  }
  let output: string;
  try {
    output = await run(main.path, [
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      pullRequestLimit,
      "--json",
      "number,state,isDraft,headRefName,title,url"
    ]);
  } catch (error) {
    return { status: "unavailable", reason: unavailableReason(error) };
  }
  try {
    return { status: "ready", byBranch: byBranch(output) };
  } catch {
    return {
      status: "unavailable",
      reason:
        "gh returned pull requests in an unexpected format. Update gh, then rescan."
    };
  }
}
