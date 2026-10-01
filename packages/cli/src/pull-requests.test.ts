import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { pullRequestFor, type PullRequestsByBranch } from "@agent-mapper/core";
import { pullRequests, type GhRunner } from "./pull-requests";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function repository(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-prs-")));
  roots.push(root);
  execFileSync("git", ["-C", root, "init", "-b", "main"], { stdio: "ignore" });
  return root;
}

interface GhFailure {
  code?: string;
  stderr?: string;
  killed?: boolean;
  signal?: string;
}

const failing =
  (failure: GhFailure): GhRunner =>
  () =>
    Promise.reject(Object.assign(new Error("gh failed"), failure));

/** One row of `gh pr list --json`: "branch#number STATE title", with "draft" appended for drafts. */
function listed(row: string) {
  const [head = "", state = "", title = "", draft] = row.split(" ");
  const [headRefName, number] = head.split("#");
  return {
    headRefName,
    number: Number(number),
    state,
    isDraft: draft === "draft",
    title,
    url: `u${number}`
  };
}

it("keeps the most relevant pull request per branch", async () => {
  const root = repository();
  const calls: string[] = [];
  const run: GhRunner = (directory) => {
    calls.push(directory);
    return Promise.resolve(
      JSON.stringify([
        listed("feat/a#9 CLOSED Retry"),
        listed("feat/a#8 OPEN A draft"),
        listed("feat/b#7 MERGED B"),
        listed("feat/b#6 MERGED Old_B"),
        listed("feat/c#5 CLOSED C"),
        { ...listed("feat/d#4 OPEN Fork"), isCrossRepository: true },
        { headRefName: 3, number: "bad" }
      ])
    );
  };
  expect(await pullRequests(root, run)).toEqual({
    status: "ready",
    byBranch: {
      "feat/a": { number: 8, state: "draft", title: "A", url: "u8" },
      "feat/b": { number: 7, state: "merged", title: "B", url: "u7" },
      "feat/c": { number: 5, state: "closed", title: "C", url: "u5" }
    },
    truncated: false
  });
  expect(calls).toEqual([root]);
});

it("treats branch names that match Object members as plain branches", async () => {
  const root = repository();
  const names = ["constructor", "toString", "__proto__"];
  const result = await pullRequests(root, () =>
    Promise.resolve(
      JSON.stringify(
        names.map((name, index) => listed(`${name}#${index + 1} OPEN T`))
      )
    )
  );
  if (result.status !== "ready") {
    throw new Error("expected a ready lookup");
  }
  // The wire round trip matters: the browser reads a JSON-parsed object.
  const received = JSON.parse(
    JSON.stringify(result.byBranch)
  ) as PullRequestsByBranch;
  expect(names.map((name) => pullRequestFor(received, name)?.number)).toEqual([
    1, 2, 3
  ]);
  expect(Object.getPrototypeOf(result.byBranch)).toBe(Object.prototype);
  expect(pullRequestFor({}, "constructor")).toBeUndefined();
});

it("asks gh from the main checkout when given a linked worktree", async () => {
  const root = repository();
  const linked = `${root}-linked`;
  roots.push(linked);
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=T",
      "-c",
      "user.email=t@e.x",
      "commit",
      "--allow-empty",
      "-m",
      "init"
    ],
    { stdio: "ignore" }
  );
  execFileSync(
    "git",
    ["-C", root, "worktree", "add", "-b", "feature", linked],
    {
      stdio: "ignore"
    }
  );
  const calls: string[] = [];
  const full = Array.from({ length: 200 }, (_, index) =>
    listed(`b${index}#${index + 1} MERGED T`)
  );
  const result = await pullRequests(linked, (directory) => {
    calls.push(directory);
    return Promise.resolve(JSON.stringify(full));
  });
  expect(calls).toEqual([root]);
  expect(result.status === "ready" && result.truncated).toBe(true);
});

it("explains a missing, logged-out, or remote-less gh instead of failing", async () => {
  const root = repository();
  const reason = async (run: GhRunner) => {
    const result = await pullRequests(root, run);
    return result.status === "unavailable" ? result.reason : "ready";
  };
  expect(await reason(failing({ code: "ENOENT" }))).toBe(
    "Install the GitHub CLI (gh) to see pull request status."
  );
  expect(
    await reason(
      failing({
        stderr: "To get started with GitHub CLI, please run:  gh auth login"
      })
    )
  ).toBe("Run gh auth login to see pull request status.");
  expect(await reason(failing({ stderr: "no git remotes found" }))).toBe(
    "This repository has no GitHub remote, so there are no pull requests to show."
  );
});

it("reports other gh failures as errors", async () => {
  const root = repository();
  await expect(
    pullRequests(root, failing({ killed: true, signal: "SIGTERM" }))
  ).rejects.toThrow(
    "GitHub did not answer within 20 seconds. Rescan to try again."
  );
  await expect(
    pullRequests(
      root,
      failing({ stderr: "HTTP 403: API rate limit exceeded\n" })
    )
  ).rejects.toThrow(
    "gh could not list pull requests: HTTP 403: API rate limit exceeded. Run gh pr list in the repository to see why."
  );
  await expect(pullRequests(root, () => Promise.resolve("{}"))).rejects.toThrow(
    "gh returned pull requests in an unexpected format. Update gh, then rescan."
  );
});

it("rejects folders outside Git and relative paths", async () => {
  const plain = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-plain-"))
  );
  roots.push(plain);
  const never: GhRunner = () => Promise.reject(new Error("gh must not run"));
  await expect(pullRequests(plain, never)).rejects.toThrow(
    `${plain} is not a Git repository. Rescan to refresh.`
  );
  await expect(pullRequests("app", never)).rejects.toThrow(
    "Send the repository's absolute folder path."
  );
});
