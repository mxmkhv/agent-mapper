import { coverageAreas, coverageProblems } from "@agent-mapper/core";
import { tildeText, type PathContext } from "../model/paths";
import { PixelIcon } from "../ui/pixel-icon";
import { Section } from "./inspector-sections";

/** One row per area; the full notes stay in the CLI output and each row's tooltip. */
export function CoverageInspector({
  notes,
  context
}: {
  notes: string[];
  context: PathContext;
}) {
  const problems = coverageProblems(notes);
  return (
    <div className="px-5 pt-4.5 pb-7">
      <div className="flex items-center gap-2 text-label text-ink-muted">
        <PixelIcon name="info" />
        Coverage
      </div>
      <h2 className="mt-2.5 mb-4 font-mono text-title">
        Not verified by this scan
      </h2>
      {problems.length ? (
        <Section
          title={`${problems.length} scan ${problems.length === 1 ? "problem" : "problems"}`}
        >
          <ul className="m-0 grid list-none gap-1.5 p-0 text-label text-problem">
            {problems.map((problem) => (
              <li className="break-words" key={problem}>
                {tildeText(problem, context)}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <dl className="m-0 mt-4 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5 text-label">
        {coverageAreas.map((area) => (
          <div className="contents" key={area.area} title={area.detail}>
            <dt className="font-semibold">{area.area}</dt>
            <dd className="m-0 text-ink-muted">{area.notVerified}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
