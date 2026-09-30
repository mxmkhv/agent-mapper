import { execFile } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  PullRequestLookup,
  PullRequestsByBranch,
  PullRequestSummary
} from "@agent-mapper/core";
import { repositoryWorktrees } from "./worktree-git";

const execute = promisify(execFile);
const ghTimeoutMs = 20_000;
const pullRequestLimit = 200;

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
  // A fork's branch can share a local branch name without being that branch.
  if (
    item.isCrossRepository === true ||
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

/**
 * gh lists newest first; keep the first PR of the best rank per branch. A Map, then fromEntries: branch names
 * such as "constructor" or "__proto__" must neither read nor replace Object.prototype members.
 */
function byBranch(listed: unknown[]): PullRequestsByBranch {
  const best = new Map<string, PullRequestSummary>();
  for (const [branch, pr] of listed.map(summary).filter((item) => !!item)) {
    const current = best.get(branch);
    if (!current || rank[pr.state] < rank[current.state]) {
      best.set(branch, pr);
    }
  }
  return Object.fromEntries(best);
}

interface GhFailure {
  code?: unknown;
  killed?: boolean;
  signal?: unknown;
  stderr?: unknown;
  message?: unknown;
}

/**
 * The three expected situations (no gh, logged out, no GitHub remote) are quiet reasons. Anything else, such
 * as a network failure, rate limit, or SSO prompt, is an error the user should see as one.
 */
function ghFailure(error: unknown): PullRequestLookup {
  const failure = (error ?? {}) as GhFailure;
  const stderr = typeof failure.stderr === "string" ? failure.stderr : "";
  const unavailable = (reason: string): PullRequestLookup => ({
    status: "unavailable",
    reason
  });
  if (failure.code === "ENOENT") {
    return unavailable(
      "Install the GitHub CLI (gh) to see pull request status."
    );
  }
  if (/auth login|not logged in/i.test(stderr)) {
    return unavailable("Run gh auth login to see pull request status.");
  }
  if (/no git remotes|none of the git remotes|not a github/i.test(stderr)) {
    return unavailable(
      "This repository has no GitHub remote, so there are no pull requests to show."
    );
  }
  if (failure.killed && failure.signal === "SIGTERM") {
    throw new Error(
      "GitHub did not answer within 20 seconds. Rescan to try again.",
      {
        cause: error
      }
    );
  }
  const detail =
    stderr.trim().split("\n")[0] ||
    (typeof failure.message === "string" ? failure.message : String(error));
  throw new Error(
    `gh could not list pull requests: ${detail}. Run gh pr list in the repository to see why.`,
    { cause: error }
  );
}

function parseListed(output: string): unknown[] {
  let listed: unknown;
  try {
    listed = JSON.parse(output);
  } catch (error) {
    throw new Error(
      "gh returned pull requests that are not JSON. Update gh, then rescan.",
      { cause: error }
    );
  }
  if (!Array.isArray(listed)) {
    throw new TypeError(
      "gh returned pull requests in an unexpected format. Update gh, then rescan."
    );
  }
  return listed;
}

/**
 * Asks GitHub, through the user's gh login, for the pull requests of the repository that contains `value`.
 * Read-only. A missing or logged-out gh, or a repository without a GitHub remote, is a reason; other gh
 * failures are errors.
 */
export async function pullRequests(
  value: string | null,
  run: GhRunner = runGh
): Promise<PullRequestLookup> {
  if (!value || !isAbsolute(value)) {
    throw new Error("Send the repository's absolute folder path.");
  }
  const main = (await repositoryWorktrees(resolve(value))).find(
    (tree) => tree.isMain
  );
  if (!main) {
    throw new Error(`${value} is not a Git repository. Rescan to refresh.`);
  }
  if (main.state !== "available") {
    throw new Error(
      `The main checkout ${main.path} is ${main.state}. Restore it, then rescan.`
    );
  }
  let output: string;
  try {
    output = await run(main.path, [
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      String(pullRequestLimit),
      "--json",
      "number,state,isDraft,isCrossRepository,headRefName,title,url"
    ]);
  } catch (error) {
    return ghFailure(error);
  }
  const listed = parseListed(output);
  return {
    status: "ready",
    byBranch: byBranch(listed),
    truncated: listed.length >= pullRequestLimit
  };
}
