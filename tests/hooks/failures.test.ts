import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";
import { projectRoot } from "./fixtures";

it.each(["guard", "lint-edited", "stop-gate"])(
  "%s reports malformed input",
  (mode) => {
    const result = spawnSync(
      "bash",
      [join(projectRoot, `.agent-hooks/${mode}.sh`)],
      { input: "{invalid", encoding: "utf8" }
    );
    if (mode === "guard") {
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("could not run");
    } else {
      expect(result.status).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      expect(result.stdout).toContain("DID NOT RUN");
    }
  }
);

it.each(["guard", "lint-edited", "stop-gate"])(
  "%s reports missing Bun without jq",
  (mode) => {
    const result = spawnSync(
      "/bin/bash",
      [join(projectRoot, `.agent-hooks/${mode}.sh`)],
      {
        input: "{}",
        encoding: "utf8",
        env: { ...process.env, PATH: "/usr/bin:/bin" }
      }
    );
    expect(result.status).toBe(mode === "guard" ? 2 : 0);
    expect(result.stdout + result.stderr).toContain("bun is missing");
    if (mode !== "guard") {
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    }
  }
);
