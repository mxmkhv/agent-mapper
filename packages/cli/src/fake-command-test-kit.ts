import {
  chmodSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const executable = 0o755;

/**
 * A PATH holding only shell scripts that stand in for desktop helpers such as xdg-open.
 * Each run records its arguments, one per line, so tests see exactly what was spawned.
 */
export function fakeCommands(scripts: Record<string, string>) {
  const bin = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-bin-")));
  const log = join(bin, "calls");
  for (const [name, body] of Object.entries(scripts)) {
    const path = join(bin, name);
    writeFileSync(
      path,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}.${name}.$$"\n${body}\n`
    );
    chmodSync(path, executable);
  }
  return {
    env: { PATH: bin },
    /** The arguments of every run of `name` so far. */
    calls(name: string): string[][] {
      return readdirSync(bin)
        .filter((file) => file.startsWith(`calls.${name}.`))
        .map((file) =>
          readFileSync(join(bin, file), "utf8").split("\n").slice(0, -1)
        );
    },
    remove() {
      rmSync(bin, { recursive: true, force: true });
    }
  };
}
