import type { ImpactAssociation, SourceImpact } from "@agent-mapper/core";
import { tildePath, type PathContext } from "../model/paths";
import { ToolGlyph } from "../ui/marks";

/** What the current view knows about scan coverage, so impact is never overstated. */
export type ImpactCoverage =
  | {
      mode: "global";
      total: number;
      scanned: number;
      pending: number;
      failed: number;
    }
  | { mode: "project"; workingDirectory: string };

const availabilityWord: Record<ImpactAssociation["availability"], string> = {
  expected: "applies",
  shadowed: "shadowed",
  "not-applicable": "not used",
  unknown: "unknown"
};

const baseName = (path: string) => path.split("/").at(-1) ?? path;
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/** The caveat behind every count: only scanned contexts are known. */
function coverageNote(coverage: ImpactCoverage): string {
  return coverage.mode === "global"
    ? "Only scanned projects are known. Discovery skips excluded folders and deep paths, so other projects may also use this file."
    : "Only this project and previously scanned projects are known. Projects that have not been scanned may also use this file.";
}

/** Scans still running or failed change what the list can claim, so they stay visible. */
function scanGaps(coverage: ImpactCoverage): string | undefined {
  if (coverage.mode !== "global") {
    return undefined;
  }
  const gaps = [
    coverage.pending
      ? `${plural(coverage.pending, "project")} still scanning`
      : "",
    coverage.failed
      ? `${plural(coverage.failed, "project")} failed to scan`
      : ""
  ].filter(Boolean);
  return gaps.length ? gaps.join(" · ") : undefined;
}

function groupByContext(contexts: readonly ImpactAssociation[]) {
  const groups = new Map<string, ImpactAssociation[]>();
  for (const context of contexts) {
    const key = `${context.scope}\0${context.workingDirectory}`;
    groups.set(key, [...(groups.get(key) ?? []), context]);
  }
  return [...groups.values()];
}

function heading(groups: readonly ImpactAssociation[][]): string {
  const projects = groups.filter((group) => group[0]?.scope === "project");
  const parts = [
    groups.length > projects.length ? "global configuration" : "",
    projects.length ? `${plural(projects.length, "scanned project")}` : ""
  ].filter(Boolean);
  return parts.length
    ? `Affects ${parts.join(" and ")}`
    : "No scanned context uses this file";
}

export function ImpactSummary({
  impact,
  coverage,
  context
}: {
  impact: SourceImpact;
  coverage: ImpactCoverage;
  context: PathContext;
}) {
  const groups = groupByContext(impact.contexts);
  const gaps = scanGaps(coverage);
  return (
    <section aria-label="Known affected contexts">
      <h3
        className="m-0 mb-1.5 text-caption font-semibold text-ink-faint"
        title={coverageNote(coverage)}
      >
        {heading(groups)}
      </h3>
      {gaps ? (
        <p className="m-0 mb-1.5 text-caption text-ink-muted">{gaps}</p>
      ) : null}
      <ul className="m-0 grid list-none gap-2 p-0 text-label">
        {groups.map((group) => {
          const first = group[0]!;
          const scanned = new Date(first.scannedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });
          return (
            <li key={`${first.scope}:${first.workingDirectory}`}>
              <strong
                className="font-semibold"
                title={`${tildePath(first.workingDirectory, context)} · scanned ${scanned}`}
              >
                {first.scope === "global"
                  ? "Global"
                  : baseName(first.workingDirectory)}
              </strong>
              {group.map((item) => (
                <span
                  className="flex items-center gap-1.5"
                  key={item.entryId}
                  title={`${tildePath(item.path, context)}\n${item.reason}`}
                >
                  <ToolGlyph tool={item.tool} />
                  <span className="min-w-0 flex-1 truncate font-mono text-mono">
                    {baseName(item.path)}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {availabilityWord[item.availability]}
                  </span>
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 mb-0 text-caption text-ink-faint">
        Restart running sessions to pick this up.
      </p>
    </section>
  );
}
