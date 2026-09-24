import { resolve } from "node:path";
import { lint } from "./checks";
import { changedPaths, repository, sourceFiles } from "./git";
import { errorMessage, patchPaths, readInput, report } from "./io";

try {
  const input = readInput();
  const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const root = repository(cwd);
  const direct = input.tool_input?.file_path;
  const patches = patchPaths(input.tool_input?.command ?? "");
  let paths = changedPaths(root);
  if (direct) {
    paths = [resolve(cwd, direct)];
  } else if (input.tool_name === "apply_patch") {
    paths = patches.map((path) => resolve(cwd, path));
  }
  const failure = lint(root, sourceFiles(root, paths));
  if (failure) {
    report(`QUALITY GATE: ${failure}\nFix these violations before continuing.`);
  }
} catch (error) {
  report(
    `QUALITY GATE DID NOT RUN: ${errorMessage(error)} Fix the hook setup, then run bun run lint.`
  );
}
