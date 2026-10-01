import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { InventoryEntry, SkillSource } from "@agent-mapper/core";

type LockedSkills = ReadonlyMap<string, SkillSource>;

function lockedSkills(parsed: unknown): LockedSkills {
  const skills = new Map<string, SkillSource>();
  const listed = (parsed as { skills?: unknown } | null)?.skills;
  if (typeof listed !== "object" || listed === null) {
    return skills;
  }
  for (const [name, value] of Object.entries(listed)) {
    const { source, ref } = (value ?? {}) as {
      source?: unknown;
      ref?: unknown;
    };
    if (typeof source === "string" && source) {
      skills.set(name, {
        repo: source,
        ref: typeof ref === "string" && ref ? ref : undefined
      });
    }
  }
  return skills;
}

async function readLock(path: string, errors: string[]): Promise<LockedSkills> {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    // Most folders have no lock file: their skills were written by hand, not installed.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: Could not read the skills lock file, so installed skills show no source repo. Check permissions.`
      );
    }
    return new Map();
  }
  try {
    return lockedSkills(JSON.parse(text));
  } catch {
    errors.push(
      `${path}: The skills lock file is not valid JSON, so installed skills show no source repo. Reinstall the skills or fix the file.`
    );
    return new Map();
  }
}

/**
 * The `skills` installer records the repo each skill came from: `skills-lock.json` in a project,
 * `~/.agents/.skill-lock.json` for global installs. Both are keyed by the skill's folder name.
 */
export async function attachSkillSources(
  entries: readonly InventoryEntry[],
  home: string
): Promise<string[]> {
  const errors: string[] = [];
  const locks = new Map<string, Promise<LockedSkills>>();
  for (const entry of entries) {
    if (entry.kind !== "skill" || entry.pluginId || entry.scope === "managed") {
      continue;
    }
    const lockPath = entry.projectPath
      ? join(entry.projectPath, "skills-lock.json")
      : join(home, ".agents", ".skill-lock.json");
    let lock = locks.get(lockPath);
    if (!lock) {
      lock = readLock(lockPath, errors);
      locks.set(lockPath, lock);
    }
    const folder = basename(dirname(entry.realPath ?? entry.path));
    entry.installedFrom = (await lock).get(folder);
  }
  return errors;
}
