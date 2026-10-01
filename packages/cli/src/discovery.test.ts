import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { discoverProjects } from "./discovery";

it("discovers project hits across batches of sibling folders", async () => {
  const home = mkdtempSync(join(tmpdir(), "agent-mapper-discovery-"));
  const names = Array.from(
    { length: 20 },
    (_, index) => `project-${String(index).padStart(2, "0")}`
  );
  try {
    for (const name of names) {
      const path = join(home, "work", name);
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, "AGENTS.md"), "Project instructions");
    }
    const result = await discoverProjects(home);
    expect(result.projects.map(({ path }) => path)).toEqual(
      names.map((name) => join(home, "work", name))
    );
    expect(result.errors).toEqual([]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
