import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
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
    }
  });
  expect(calls).toEqual([root]);
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
  expect(await reason(failing({ killed: true }))).toBe(
    "GitHub did not answer in time. Rescan to try again."
  );
  expect(await reason(() => Promise.resolve("{}"))).toBe(
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
