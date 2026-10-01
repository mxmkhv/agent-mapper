import { lint, typecheck } from "./checks";
import { changedPaths, repository, sourceFiles } from "./git";
import { errorMessage, readInput, report } from "./io";

try {
  const input = readInput();
  if (!input.stop_hook_active) {
    const root = repository(
      input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
    );
    const changes = changedPaths(root);
    if (changes.length > 0) {
      const failures = [];
      const lintFailure = lint(root, sourceFiles(root, changes));
      if (lintFailure) {
        failures.push(`oxlint:\n${lintFailure}`);
      }
      if (process.env.AGENT_STOP_TYPECHECK !== "0") {
        const typeFailure = typecheck(root);
        if (typeFailure) {
          failures.push(`test:ts:\n${typeFailure}`);
        }
      }
      if (failures.length > 0) {
        report(
          `QUALITY GATE FAILED:\n${failures.join("\n\n")}\nFix the failures and rerun the failed checks. This gate continues the agent once; the next stop does not recheck.`,
          true
        );
      }
    }
  }
} catch (error) {
  report(
    `QUALITY GATE DID NOT RUN: ${errorMessage(error)} Fix the hook setup and run bun run validate before finishing.`,
    true
  );
}
