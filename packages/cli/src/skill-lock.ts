import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { InventoryEntry, SkillSource } from "@agent-mapper/core";

type LockedSkills = ReadonlyMap<string, SkillSource>;

interface ParsedLock {
  skills: LockedSkills;
  /** What is wrong with the file or some of its entries, phrased for the coverage notes. */
  problem?: string;
}

const noSources = "so installed skills show no source repo";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The usable entries of a parsed lock file, plus what is wrong with the rest of it, if anything. */
function lockedSkills(parsed: unknown): ParsedLock {
  const skills = new Map<string, SkillSource>();
  const listed = isRecord(parsed) ? parsed.skills : undefined;
  if (!isRecord(listed)) {
    return {
      skills,
      problem: `The skills lock file has an unexpected structure (no "skills" object), ${noSources}. Reinstall the skills or update agent-mapper.`
    };
  }
  const unreadable: string[] = [];
  for (const [name, value] of Object.entries(listed)) {
    const source = isRecord(value) ? value.source : undefined;
    const ref = isRecord(value) ? value.ref : undefined;
    if (typeof source === "string" && source) {
      skills.set(name, {
        repo: source,
        ref: typeof ref === "string" && ref ? ref : undefined
      });
    } else {
      unreadable.push(name);
    }
  }
  return {
    skills,
    problem: unreadable.length
      ? `No readable "source" for ${unreadable.join(", ")}, so those skills show no source repo. Reinstall them or update agent-mapper.`
      : undefined
  };
}

async function readLock(path: string, errors: string[]): Promise<LockedSkills> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    // Most folders have no lock file: their skills were written by hand, not installed.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: Could not read the skills lock file (${error instanceof Error ? error.message : String(error)}), ${noSources}. Check that it is a readable file.`
      );
    }
    return new Map();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    errors.push(
      `${path}: The skills lock file is not valid JSON, ${noSources}. Reinstall the skills or fix the file.`
    );
    return new Map();
  }
  const { skills, problem } = lockedSkills(parsed);
  if (problem) {
    errors.push(`${path}: ${problem}`);
  }
  return skills;
}

/**
 * Sets `installedFrom` on the given skill entries, in place, and returns messages for lock files
 * that could not be used. The `skills` installer writes `skills-lock.json` in a project and
 * `~/.agents/.skill-lock.json` for global installs; a skill is matched to its lock entry by the
 * name of the folder its real file sits in. Plugin and managed skills are never installer-owned.
 */
export async function attachSkillSources(
  entries: readonly InventoryEntry[],
  home: string
): Promise<string[]> {
  const errors: string[] = [];
  const locks = new Map<string, LockedSkills>();
  for (const entry of entries) {
    if (entry.kind !== "skill" || entry.pluginId || entry.scope === "managed") {
      continue;
    }
    const lockPath = entry.projectPath
      ? join(entry.projectPath, "skills-lock.json")
      : join(home, ".agents", ".skill-lock.json");
    const lock = locks.get(lockPath) ?? (await readLock(lockPath, errors));
    locks.set(lockPath, lock);
    const folder = basename(dirname(entry.realPath ?? entry.path));
    entry.installedFrom = lock.get(folder);
  }
  return errors;
}
