import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "../..");
const hookTimeoutMs = 20000;
import type { HookInput } from "../../.agent-hooks/io";

export function fixture() {
  const root = mkdtempSync(join(tmpdir(), "agent-mapper-hooks-"));
  mkdirSync(join(root, "src"));
  execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "config", "user.name", "Hook Test"]);
  execFileSync("git", [
    "-C",
    root,
    "config",
    "user.email",
    "hooks@example.test"
  ]);
  writeFileSync(join(root, ".gitignore"), "node_modules/\ntools/\n");
  writeConfiguration(root);
  writeFileSync(
    join(root, "oxlint.config.ts"),
    `export { default } from ${JSON.stringify(join(projectRoot, "oxlint.config.ts"))};\n`
  );
  writeFileSync(join(root, "src/kept.ts"), "export const value = 1;\n");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", [
    "-C",
    root,
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "fixture"
  ]);
  symlinkSync(join(projectRoot, "node_modules"), join(root, "node_modules"));
  symlinkSync(join(projectRoot, "tools"), join(root, "tools"));
  return {
    root,
    dispose: () => rmSync(root, { recursive: true, force: true })
  };
}

export function runHook(mode: string, input: HookInput) {
  return spawnSync("bash", [join(projectRoot, `.agent-hooks/${mode}.sh`)], {
    cwd: input.cwd ?? projectRoot,
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: hookTimeoutMs
  });
}

function writeConfiguration(root: string): void {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      scripts: {
        "test:ts": "tsc --noEmit -p tsconfig.json",
        "lint:staged": "lint-staged",
        validate: "bun run test:ts && vitest run"
      },
      "lint-staged": {
        "*.ts": [
          "prettier --write",
          "oxlint -c oxlint.config.ts --deny-warnings"
        ]
      }
    })
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        types: []
      },
      include: ["src/**/*.ts"]
    })
  );
}
