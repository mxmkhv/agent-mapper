import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { fileExists, safePath } from "./plugin-contribution-utils";

it.skipIf(process.getuid?.() === 0)(
  "reports inaccessible plugin files and paths",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-mapper-plugin-access-"));
    const blocked = join(root, "blocked");
    const file = join(blocked, "SKILL.md");
    mkdirSync(blocked);
    writeFileSync(file, "name: blocked");
    chmodSync(blocked, 0o000);
    try {
      await expect(fileExists(file)).rejects.toThrow(
        "Could not inspect plugin file"
      );
      await expect(safePath(root, "./blocked/SKILL.md")).rejects.toThrow(
        "Could not resolve plugin path"
      );
    } finally {
      chmodSync(blocked, 0o700);
      rmSync(root, { recursive: true, force: true });
    }
  }
);
