import { expect, it } from "vitest";
import { projectRoot, runHook } from "./fixtures";

it.each([
  "npm i x",
  " npm i x",
  "CI=1 npm i x",
  "echo ready\nnpm i x",
  "env npm i x",
  "cd a && npx foo",
  "/usr/local/bin/yarn",
  "pnpm add x"
])("blocks %s", (command) => {
  const result = runHook("guard", {
    tool_name: "Bash",
    tool_input: { command },
    cwd: projectRoot
  });
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("bun");
});
it.each([
  "bun install",
  "echo npm",
  'git commit -m "npm"',
  "bunx oxlint",
  "cat oxlint.config.ts",
  "grep x oxlint.config.ts",
  'git commit -m "mention oxlint.config.ts"'
])("allows %s", (command) => {
  expect(
    runHook("guard", { tool_name: "Bash", tool_input: { command } }).status
  ).toBe(0);
});
it.each([
  "echo x > oxlint.config.ts",
  "sed -i x oxlint.config.ts",
  "rm tools/oxlint/anti-slop/index.ts",
  `python3 -c 'open("oxlint.config.ts", "w").write("x")'`
])("protects configuration from %s", (command) => {
  expect(
    runHook("guard", { tool_name: "Bash", tool_input: { command } }).status
  ).toBe(2);
});
it("protects direct edits", () => {
  expect(
    runHook("guard", {
      tool_name: "Edit",
      tool_input: { file_path: "oxlint.config.ts" }
    }).status
  ).toBe(2);
});
it("protects patch destinations", () => {
  expect(
    runHook("guard", {
      tool_name: "apply_patch",
      tool_input: {
        command:
          "*** Begin Patch\n*** Update File: oxlint.config.ts\n*** End Patch"
      }
    }).status
  ).toBe(2);
});
