import { homedir } from "node:os";
import type {
  ResolvedEntry,
  UsageCoverage,
  UsageRecord,
  UsageSummary
} from "@agent-mapper/core";
import { readClaudeLogs, type SkillCall } from "./claude-log-reader";

function coverageFrom(dates: string[], sessions: Set<string>): UsageCoverage {
  return {
    sessions: sessions.size,
    from: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined,
    to: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined
  };
}

function skillCandidates(items: ResolvedEntry[]): Map<string, ResolvedEntry[]> {
  const claudeSkills = items.filter(
    ({ entry }) => entry.tool === "claude" && entry.kind === "skill"
  );
  const candidates = new Map<string, ResolvedEntry[]>();
  for (const item of claudeSkills) {
    const group = candidates.get(item.entry.name) ?? [];
    group.push(item);
    candidates.set(item.entry.name, group);
  }
  return candidates;
}

function eligibleSkill(item: ResolvedEntry | undefined): item is ResolvedEntry {
  return Boolean(
    item &&
    item.entry.tool === "claude" &&
    !item.entry.pluginId &&
    item.entry.readState === "readable" &&
    item.resolution.availability === "expected"
  );
}

function attributeCalls(
  calls: SkillCall[],
  candidates: Map<string, ResolvedEntry[]>
) {
  const matched = new Map<string, SkillCall[]>();
  let unattributedInvocations = 0;
  for (const call of calls) {
    const group = candidates.get(call.name);
    const item = group?.length === 1 ? group[0] : undefined;
    if (!eligibleSkill(item)) {
      unattributedInvocations++;
      continue;
    }
    const events = matched.get(item.entry.id) ?? [];
    events.push(call);
    matched.set(item.entry.id, events);
  }
  return { matched, unattributedInvocations };
}

interface RecordContext {
  matched: Map<string, SkillCall[]>;
  candidates: Map<string, ResolvedEntry[]>;
  coverage: UsageCoverage;
  incomplete: boolean;
}

function buildRecords(
  items: ResolvedEntry[],
  context: RecordContext
): UsageRecord[] {
  return items
    .filter(({ entry }) => entry.kind === "skill")
    .map((item) => {
      const events = context.matched.get(item.entry.id) ?? [];
      const eligible =
        eligibleSkill(item) &&
        context.candidates.get(item.entry.name)?.length === 1;
      let state: UsageRecord["state"] = "uncovered";
      if (events.length > 0) {
        state = "recorded";
      } else if (
        eligible &&
        context.coverage.sessions > 0 &&
        !context.incomplete
      ) {
        state = "none";
      }
      return {
        entryId: item.entry.id,
        state,
        eventType: "invocation",
        count: events.length,
        lastRecorded: events.reduce<string | undefined>(
          (latest, event) =>
            latest && latest > event.timestamp ? latest : event.timestamp,
          undefined
        ),
        coverage: context.coverage
      };
    });
}

export async function readClaudeUsage(options: {
  home?: string;
  projectDirectory: string;
  items: ResolvedEntry[];
}): Promise<UsageSummary> {
  const evidence = await readClaudeLogs(
    options.home ?? homedir(),
    options.projectDirectory
  );
  const coverage = coverageFrom(evidence.dates, evidence.sessions);
  const candidates = skillCandidates(options.items);
  const { matched, unattributedInvocations } = attributeCalls(
    evidence.calls,
    candidates
  );
  return {
    records: buildRecords(options.items, {
      matched,
      candidates,
      coverage,
      incomplete: evidence.incomplete
    }),
    coverage,
    unattributedInvocations,
    notes: [
      "Claude Code Skill tool calls are counted as invocations, not completions or successful uses.",
      "Codex usage, agent calls, hook runs, and instruction loading have no validated item-level coverage.",
      ...(evidence.incomplete
        ? [
            "Some Claude Code logs could not be read; absence of a call is not treated as no recorded use."
          ]
        : [])
    ]
  };
}
