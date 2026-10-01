import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildSnapshot } from "./service";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-hooks-")));
  roots.push(home);
  const project = join(home, "app");
  mkdirSync(join(project, ".git"), { recursive: true });
  return { home, project, codexHome: join(home, ".codex") };
}

it("reports hook declarations of the wrong shape instead of dropping them", async () => {
  const options = fixture();
  mkdirSync(join(options.home, ".claude"));
  const settings = join(options.home, ".claude", "settings.json");
  writeFileSync(
    settings,
    JSON.stringify({
      hooks: {
        Stop: { hooks: [] },
        PreToolUse: ["Bash", { hooks: ["./check.sh"] }]
      }
    })
  );
  const snapshot = await buildSnapshot(options.project, options);
  expect(snapshot.hooks).toEqual([]);
  expect(snapshot.coverage).toEqual(
    expect.arrayContaining([
      `${settings}: hooks.Stop must be a list of matcher groups; it was skipped.`,
      `${settings}: hooks.PreToolUse[0] must be an object with a hooks list; it was skipped.`,
      `${settings}: hooks.PreToolUse[1].hooks[0] must be an object; it was skipped.`
    ])
  );
});
