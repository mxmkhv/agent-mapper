import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { fixture, runHook } from "./fixtures";

const repos: ReturnType<typeof fixture>[] = [];
function repo() {
  const value = fixture();
  repos.push(value);
  return value.root;
}
afterEach(() => {
  for (const item of repos.splice(0)) {
    item.dispose();
  }
});
const violation =
  "export const read = (input: object) => Reflect.get(input, 'value');\n";

it("reports real anti-slop failures as context without blocking", () => {
  const root = repo();
  writeFileSync(join(root, "src/bad.ts"), violation);
  const result = runHook("lint-edited", {
    cwd: root,
    tool_name: "Write",
    tool_input: { file_path: "src/bad.ts" }
  });
  expect(result.status).toBe(0);
  expect(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext
  ).toContain("anti-slop");
});
it("resolves edits from a package working directory", () => {
  const root = repo();
  writeFileSync(join(root, "src/bad.ts"), violation);
  const result = runHook("lint-edited", {
    cwd: join(root, "src"),
    tool_name: "Edit",
    tool_input: { file_path: "bad.ts" }
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("anti-slop");
});
it("reads Codex patch file paths", () => {
  const root = repo();
  writeFileSync(join(root, "src/bad.ts"), violation);
  const result = runHook("lint-edited", {
    cwd: root,
    tool_name: "apply_patch",
    tool_input: {
      command: "*** Begin Patch\n*** Add File: src/bad.ts\n*** End Patch"
    }
  });
  expect(result.stdout).toContain("anti-slop");
});
it("catches shell writes even when timestamps are old", () => {
  const root = repo();
  const file = join(root, "src/bad.ts");
  writeFileSync(file, violation);
  utimesSync(file, 1, 1);
  const result = runHook("lint-edited", {
    cwd: root,
    tool_name: "Bash",
    tool_input: { command: "cp -p source src/bad.ts" }
  });
  expect(result.stdout).toContain("anti-slop");
});
it("has no output for a clean edit", () => {
  const root = repo();
  const result = runHook("lint-edited", {
    cwd: root,
    tool_name: "Write",
    tool_input: { file_path: "src/kept.ts" }
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
});

it("blocks on a real type error", () => {
  const root = repo();
  writeFileSync(
    join(root, "src/bad.ts"),
    'export const value: number = "wrong";\n'
  );
  const result = runHook("stop-gate", { cwd: root });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ decision: "block" });
  expect(result.stdout).toContain("test:ts");
});
it("typechecks deletion-only changes", () => {
  const root = repo();
  rmSync(join(root, "src/kept.ts"));
  const result = runHook("stop-gate", { cwd: root });
  expect(result.stdout).toContain("test:ts");
});
it("typechecks config-only changes", () => {
  const root = repo();
  writeFileSync(
    join(root, "tsconfig.json"),
    '{"compilerOptions":{"target":"invalid"},"include":["src"]}'
  );
  expect(runHook("stop-gate", { cwd: root }).stdout).toContain("test:ts");
});
it("reports missing dependencies", () => {
  const root = repo();
  rmSync(join(root, "node_modules"));
  writeFileSync(join(root, "src/new.ts"), "export const x = 1;");
  expect(runHook("stop-gate", { cwd: root }).stdout).toContain("bun install");
});
it("allows the second stop and clean repositories", () => {
  const root = repo();
  expect(runHook("stop-gate", { cwd: root }).stdout).toBe("");
  writeFileSync(join(root, "src/bad.ts"), violation);
  expect(
    runHook("stop-gate", { cwd: root, stop_hook_active: true }).stdout
  ).toBe("");
});
it("reports directories outside a repository", () => {
  const root = repo();
  mkdirSync(join(root, "outside"));
  rmSync(join(root, ".git"), { recursive: true });
  const result = runHook("stop-gate", { cwd: root });
  expect(result.stdout).toContain("Git");
});
