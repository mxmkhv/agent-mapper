import type { Finding } from "@agent-mapper/core";
import { ArrowRight, Info, TriangleAlert } from "lucide-react";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import { EmptyState } from "../ui/empty-state";

const levelRank = {
  problem: 0,
  review: 1,
  information: 2,
  coverage: 3
} satisfies Record<Finding["level"], number>;

interface FindingsViewProps {
  findings: Finding[];
  context: PathContext;
  toolName: string;
  onSelect(id: string): void;
}

export function FindingsView({
  findings,
  context,
  toolName,
  onSelect
}: FindingsViewProps) {
  if (!findings.length) {
    return <EmptyState title={`No findings for ${toolName}`} />;
  }
  const sorted = [...findings].sort(
    (a, b) => levelRank[a.level] - levelRank[b.level]
  );
  return (
    <div className="grid max-w-[900px] gap-2 px-5 pt-4 pb-10">
      {sorted.map((finding) => {
        const problem = finding.level === "problem";
        const Icon = problem ? TriangleAlert : Info;
        return (
          <article
            className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 rounded-card border border-hairline bg-surface px-4 py-3.5"
            key={finding.id}
          >
            <Icon
              aria-hidden="true"
              className={`mt-0.5 size-4 ${problem ? "text-problem" : "text-ink-muted"}`}
              strokeWidth={1.6}
            />
            <div>
              <h4 className="m-0 flex items-center gap-2 font-semibold">
                {finding.title}
                <span
                  className={`rounded-pill px-2 py-px text-caption font-semibold ${problem ? "bg-problem-wash text-problem" : "bg-wash text-ink-muted"}`}
                >
                  {finding.level}
                </span>
              </h4>
              <p className="mt-1 mb-2 text-ink-muted">
                {tildeText(finding.reason, context)}
              </p>
              {finding.sources.map((source) => (
                <button
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-control px-1.5 text-label text-ink-muted hover:bg-hover hover:text-ink"
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                >
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5"
                    strokeWidth={1.6}
                  />
                  <span className="font-mono text-mono">
                    {tildePath(source.path, context)}
                  </span>
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
