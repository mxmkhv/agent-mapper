import type { ImpactAssociation, SourceImpact } from "@agent-mapper/core";
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

const availabilityText: Record<ImpactAssociation["availability"], string> = {
  expected: "Expected to apply",
  shadowed: "Shadowed by another file",
  "not-applicable": "Not used here",
  unknown: "Unknown"
};

const projectName = (path: string) => path.split("/").at(-1) ?? path;
const projects = (count: number) =>
  `${count} discovered ${count === 1 ? "project" : "projects"}`;

function coverageText(impact: SourceImpact, coverage: ImpactCoverage): string {
  if (coverage.mode === "global") {
    const counts = [
      coverage.pending ? `${coverage.pending} still scanning` : "",
      coverage.failed ? `${coverage.failed} failed to scan` : ""
    ].filter(Boolean);
    const base =
      coverage.scanned === coverage.total
        ? `Known impact across ${projects(coverage.total)}.`
        : `Known impact across ${coverage.scanned} of ${projects(coverage.total)} scanned${counts.length ? ` (${counts.join(", ")})` : ""}.`;
    return `${base} Discovery skips excluded folders and deep paths, so other projects may also use this file.`;
  }
  const others = new Set(
    impact.contexts
      .filter(
        (context) =>
          context.scope === "project" &&
          context.workingDirectory !== coverage.workingDirectory
      )
      .map((context) => context.workingDirectory)
  ).size;
  const previously = others
    ? ` and ${others} previously scanned ${others === 1 ? "project" : "projects"}`
    : "";
  return `Known impact from this project${previously}. Projects that have not been scanned may also use this file.`;
}

function groupByContext(contexts: readonly ImpactAssociation[]) {
  const groups = new Map<string, ImpactAssociation[]>();
  for (const context of contexts) {
    const key = `${context.scope}\0${context.workingDirectory}`;
    groups.set(key, [...(groups.get(key) ?? []), context]);
  }
  return [...groups.values()];
}

export function ImpactSummary({
  impact,
  coverage
}: {
  impact: SourceImpact;
  coverage: ImpactCoverage;
}) {
  const groups = groupByContext(impact.contexts);
  return (
    <section aria-label="Known affected contexts">
      <h3 className="m-0 mb-1 text-caption font-semibold text-ink-faint">
        Known affected contexts
      </h3>
      <p className="m-0 mb-2 text-label text-ink-muted">
        {coverageText(impact, coverage)}
      </p>
      {impact.aliases.length > 1 ? (
        <p className="m-0 mb-2 text-label">
          Shared file: {impact.aliases.length} paths point here. Saving changes
          all of them.
        </p>
      ) : null}
      <ul className="m-0 grid list-none gap-1.5 p-0 text-label">
        {groups.map((group) => {
          const first = group[0]!;
          return (
            <li key={`${first.scope}:${first.workingDirectory}`}>
              <strong className="font-semibold">
                {first.scope === "global"
                  ? "Global"
                  : projectName(first.workingDirectory)}
              </strong>
              <span className="text-ink-faint">
                {" "}
                · scanned{" "}
                {new Date(first.scannedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
              {group.map((item) => (
                <span
                  className="ml-3 flex items-center gap-1.5 text-ink-muted"
                  key={item.entryId}
                  title={item.reason}
                >
                  <ToolGlyph tool={item.tool} />
                  {availabilityText[item.availability]}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 mb-0 text-caption text-ink-faint">
        A saved file does not prove a running Claude Code or Codex session
        reloaded it; restart those sessions to be sure.
      </p>
    </section>
  );
}
