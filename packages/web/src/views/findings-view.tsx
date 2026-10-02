import type { Finding } from "@agent-mapper/core";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import { EmptyState } from "../ui/empty-state";
import { PixelIcon } from "../ui/pixel-icon";

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
        return (
          <article
            className="grid grid-cols-[11px_minmax(0,1fr)] gap-3 border-2 border-rule px-3 py-3"
            key={finding.id}
          >
            <PixelIcon
              className={`mt-1 ${problem ? "text-problem" : "text-ink-muted"}`}
              name={problem ? "alert" : "info"}
            />
            <div className="min-w-0">
              <h4 className="m-0 flex flex-wrap items-center gap-2 font-semibold">
                {finding.title}
                <span
                  className={`border px-1.5 font-mono text-mono ${problem ? "border-problem text-problem" : "border-ink"}`}
                >
                  {finding.level}
                </span>
              </h4>
              <p className="mt-1 mb-2 text-ink-muted">
                {tildeText(finding.reason, context)}
              </p>
              {finding.sources.map((source) => (
                <button
                  className="-ml-1.5 flex h-[26px] max-w-full items-center gap-1.5 px-1.5 font-mono text-mono text-ink-muted hover:bg-wash hover:text-ink"
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                >
                  <PixelIcon name="arrow-right" />
                  <span className="truncate">
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
