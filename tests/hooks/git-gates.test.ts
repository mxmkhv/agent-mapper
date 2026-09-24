import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fixture, projectRoot } from "./fixtures";

it("pre-commit rejects a real type error and accepts its fix", () => {
  const repo = fixture();
  try {
    execFileSync("git", [
      "-C",
      repo.root,
      "config",
      "core.hooksPath",
      join(projectRoot, ".githooks")
    ]);
    const file = join(repo.root, "src/bad.ts");
    writeFileSync(file, 'export const count: number = "wrong";\n');
    execFileSync("git", ["-C", repo.root, "add", "src/bad.ts"]);
    const failed = spawnSync(
      "git",
      ["commit", "-qm", "test: reject invalid types"],
      { cwd: repo.root, encoding: "utf8" }
    );
    expect(failed.status).not.toBe(0);
    expect(failed.stdout + failed.stderr).toContain("not assignable");
    writeFileSync(file, "export const count: number = 1;\n");
    execFileSync("git", ["-C", repo.root, "add", "src/bad.ts"]);
    const passed = spawnSync(
      "git",
      ["commit", "-qm", "test: accept valid types"],
      { cwd: repo.root, encoding: "utf8" }
    );
    expect(passed.status, passed.stdout + passed.stderr).toBe(0);
  } finally {
    repo.dispose();
  }
});

it("pre-push rejects a failing test before sending commits", () => {
  const repo = fixture();
  try {
    const remote = join(repo.root, ".git/remote.git");
    execFileSync("git", ["init", "--bare", "-q", remote]);
    execFileSync("git", ["-C", repo.root, "remote", "add", "origin", remote]);
    execFileSync("git", [
      "-C",
      repo.root,
      "config",
      "core.hooksPath",
      join(projectRoot, ".githooks")
    ]);
    writeFileSync(
      join(repo.root, "broken.test.ts"),
      'import { expect, it } from "vitest";\nit("fails", () => { expect(1).toBe(2); });\n'
    );
    const result = spawnSync("git", ["push", "origin", "HEAD:main"], {
      cwd: repo.root,
      encoding: "utf8"
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("expected 1 to be 2");
    expect(
      spawnSync("git", ["--git-dir", remote, "show-ref"], {
        encoding: "utf8"
      }).stdout.trim()
    ).toBe("");
  } finally {
    repo.dispose();
  }
});
