import { execFileSync } from "node:child_process";

/**
 * Git runs hooks with GIT_DIR and related variables pointing at this repository, and the pre-push hook runs this
 * suite. Tests build their own repositories in temp folders; inherited variables would send their `git init`,
 * `git config` and `git commit` to the real repository instead. Drop every repository-local variable Git lists.
 */
const localVariables = execFileSync("git", ["rev-parse", "--local-env-vars"], {
  encoding: "utf8"
});
for (const name of localVariables.split("\n").filter(Boolean)) {
  delete process.env[name];
}
