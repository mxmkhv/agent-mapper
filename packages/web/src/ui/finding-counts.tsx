import type { Finding } from "@agent-mapper/core";

const count = (value: number, word: string) =>
  `${value} ${word}${value === 1 ? "" : "s"}`;

/** "2 problems · 3 other", or "3 findings" when nothing is a problem. Only problems are red. */
export function FindingCounts({ findings }: { findings: readonly Finding[] }) {
  const problems = findings.filter(
    (finding) => finding.level === "problem"
  ).length;
  const others = findings.length - problems;
  return (
    <span className="tabular-nums">
      {problems ? (
        <strong className="font-semibold text-problem">
          {count(problems, "problem")}
        </strong>
      ) : null}
      {problems && others ? " · " : null}
      {others ? (
        <span className="text-ink-muted">
          {problems ? `${others} other` : count(others, "finding")}
        </span>
      ) : null}
    </span>
  );
}
