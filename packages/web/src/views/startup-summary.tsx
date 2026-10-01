import type { ContextSummary, Finding, ToolId } from "@agent-mapper/core";
import { ArrowRight } from "lucide-react";
import { shortPath, splitPath, type PathContext } from "../model/paths";
import type { InventoryRecord, Layer } from "../model/record-types";
import { approxTokens, startupFiles } from "../model/startup";
import { FindingCounts } from "../ui/finding-counts";

const layerTone = {
  managed: "bg-layer-project",
  global: "bg-layer-global",
  plugins: "bg-layer-plugins",
  project: "bg-layer-project",
  user: "bg-layer-project"
} satisfies Record<Layer, string>;

const skillTone = { claude: "bg-claude", codex: "bg-codex" } satisfies Record<
  ToolId,
  string
>;

const percent = 100;

interface StartupSummaryProps {
  title: string;
  estimate: ContextSummary[ToolId];
  tool: ToolId;
  records: readonly InventoryRecord[];
  context: PathContext;
  selectedId?: string;
  onSelect(id: string): void;
  /** Present where the findings belong to what the summary describes; opens them. */
  findings?: { list: readonly Finding[]; onOpen(): void };
}

/** The folder is what tells two CLAUDE.md files apart, so it always follows the name. Empty at the repo root. */
function folderOf(record: InventoryRecord, context: PathContext): string {
  const { directory } = splitPath(shortPath(record.path, context));
  return directory.replace(/\/$/, "");
}

/**
 * What a fresh session starts with: the instruction files in load order and the skill index, with their share of
 * the startup estimate. On demand is what could load later, not what will.
 */
export function StartupSummary(props: StartupSummaryProps) {
  const { estimate, tool } = props;
  const files = startupFiles(props.records);
  const startup = estimate.startup + estimate.skillMetadata;
  const share = (value: number) =>
    `${(value / Math.max(startup, 1)) * percent}%`;
  return (
    <section
      aria-labelledby="startup-summary-title"
      className="mb-4 rounded-card border border-hairline bg-surface px-3.5 pt-3 pb-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label text-ink-muted">
        <h2
          className="m-0 text-label font-semibold text-ink"
          id="startup-summary-title"
        >
          {props.title}
        </h2>
        <span>
          Startup{" "}
          <strong className="font-semibold text-ink tabular-nums">
            {approxTokens(startup)}
          </strong>
        </span>
        <span>
          On demand{" "}
          <strong className="font-semibold text-ink tabular-nums">
            {approxTokens(estimate.onDemand)}
          </strong>
        </span>
        {estimate.unaccountedSources ? (
          <span>{estimate.unaccountedSources} unmeasured</span>
        ) : null}
        <span className="text-caption text-ink-faint">
          Estimated tokens: characters ÷ 4
        </span>
        {props.findings?.list.length ? (
          <button
            className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-control px-1.5 text-label hover:bg-hover"
            onClick={props.findings.onOpen}
          >
            <FindingCounts findings={props.findings.list} />
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 text-ink-muted"
              strokeWidth={1.6}
            />
          </button>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-wash"
      >
        {files.map((file) => (
          <span
            className={layerTone[file.layer]}
            key={file.id}
            style={{ width: share(file.startupTokens) }}
          />
        ))}
        <span
          className={`${skillTone[tool]} opacity-55`}
          style={{ width: share(estimate.skillMetadata) }}
        />
      </div>
      <ol className="m-0 mt-1.5 -ml-1.5 flex list-none flex-wrap gap-x-1 gap-y-0.5 p-0 text-caption text-ink-muted">
        {files.map((file, index) => (
          <li className="min-w-0" key={file.id}>
            <button
              aria-current={file.id === props.selectedId ? "true" : undefined}
              className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-control px-1.5 ${file.id === props.selectedId ? "bg-selected" : "hover:bg-hover"}`}
              onClick={() => props.onSelect(file.id)}
            >
              <i
                aria-hidden="true"
                className={`inline-block size-2 shrink-0 rounded-[2px] ${layerTone[file.layer]}`}
              />
              <span className="font-mono font-semibold text-ink-faint">
                {index + 1}
              </span>
              <strong className="font-semibold whitespace-nowrap text-ink">
                {file.name}
              </strong>
              {folderOf(file, props.context) ? (
                <span className="truncate font-mono text-ink-faint">
                  {folderOf(file, props.context)}
                </span>
              ) : (
                <span className="text-ink-faint">repo root</span>
              )}
              <span className="whitespace-nowrap tabular-nums">
                {approxTokens(file.startupTokens)}
              </span>
            </button>
          </li>
        ))}
        <li className="inline-flex h-6 items-center gap-1.5 px-1.5">
          <i
            aria-hidden="true"
            className={`inline-block size-2 shrink-0 rounded-[2px] opacity-55 ${skillTone[tool]}`}
          />
          Skill index
          <span className="tabular-nums">
            {approxTokens(estimate.skillMetadata)}
          </span>
        </li>
      </ol>
    </section>
  );
}
