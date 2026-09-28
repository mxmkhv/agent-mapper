import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { createInterface } from "node:readline";

interface LogRow {
  type?: unknown;
  cwd?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
  message?: {
    content?: unknown;
  };
}

export interface SkillCall {
  name: string;
  timestamp: string;
}

export interface LogEvidence {
  project: string;
  sessions: Set<string>;
  dates: string[];
  calls: SkillCall[];
  seenCalls: Set<string>;
  incomplete: boolean;
}

function inProject(project: string, cwd: string): boolean {
  const path = relative(project, cwd);
  return (
    path === "" ||
    (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
  );
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

async function logFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(path);
      }
    }
  }
  try {
    await stat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  await walk(root);
  return files;
}

function collectSkillCalls(row: LogRow, evidence: LogEvidence): void {
  if (row.type !== "assistant" || !Array.isArray(row.message?.content)) {
    return;
  }
  for (const block of row.message.content) {
    if (
      !block ||
      typeof block !== "object" ||
      block.type !== "tool_use" ||
      block.name !== "Skill" ||
      typeof block.id !== "string" ||
      typeof block.input?.skill !== "string"
    ) {
      continue;
    }
    const key = `${row.sessionId}:${block.id}`;
    if (evidence.seenCalls.has(key)) {
      continue;
    }
    evidence.seenCalls.add(key);
    evidence.calls.push({
      name: block.input.skill,
      timestamp: new Date(row.timestamp as string).toISOString()
    });
  }
}

function collectRow(row: LogRow, evidence: LogEvidence): void {
  if (
    typeof row.cwd !== "string" ||
    !inProject(evidence.project, row.cwd) ||
    typeof row.sessionId !== "string" ||
    !validTimestamp(row.timestamp)
  ) {
    return;
  }
  evidence.sessions.add(row.sessionId);
  evidence.dates.push(new Date(row.timestamp).toISOString());
  collectSkillCalls(row, evidence);
}

async function scanLog(file: string, evidence: LogEvidence): Promise<void> {
  try {
    const lines = createInterface({
      input: createReadStream(file, { encoding: "utf8" }),
      crlfDelay: Infinity
    });
    for await (const line of lines) {
      try {
        collectRow(JSON.parse(line) as LogRow, evidence);
      } catch {
        evidence.incomplete = true;
      }
    }
  } catch {
    evidence.incomplete = true;
  }
}

export async function readClaudeLogs(
  home: string,
  project: string
): Promise<LogEvidence> {
  const evidence: LogEvidence = {
    project,
    sessions: new Set(),
    dates: [],
    calls: [],
    seenCalls: new Set(),
    incomplete: false
  };
  let files: string[];
  try {
    files = await logFiles(join(home, ".claude", "projects"));
  } catch {
    files = [];
    evidence.incomplete = true;
  }
  for (const file of files) {
    await scanLog(file, evidence);
  }
  return evidence;
}
