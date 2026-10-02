import type { ContextSummary, Finding, ToolId } from "@agent-mapper/core";
import { useState } from "react";
import {
  isInside,
  shortPath,
  splitPath,
  tildePath,
  type PathContext
} from "../model/paths";
import type { InventoryRecord, Layer } from "../model/record-types";
import { approxTokens, startupFiles } from "../model/startup";
import { FindingCounts } from "../ui/finding-counts";
import { PixelIcon } from "../ui/pixel-icon";
import { SkillIndexDialog } from "./skill-index-dialog";

/** Layers differ by dot density, not colour: the further down the stack, the lighter the fill. */
const layerDots = {
  managed: "dots-dense",
  global: "dots-dense",
  plugins: "dots-check",
  project: "dots-mid",
  user: "dots-light"
} satisfies Record<Layer, string>;

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

/** The path is what tells two CLAUDE.md files apart: a project file leads with the project's folder name, anything else reads from `~`. */
function loadPath(record: InventoryRecord, context: PathContext): string {
  const root = context.projectRoot;
  if (root && isInside(record.path, root)) {
    return `${splitPath(root).file}/${shortPath(record.path, context)}`;
  }
  return tildePath(record.path, context);
}

/**
 * What a fresh session starts with: the instruction files in load order and the skill index, with their share of
 * the startup estimate. On demand is what could load later, not what will.
 */
export function StartupSummary(props: StartupSummaryProps) {
  const { estimate, tool } = props;
  const [showSkillIndex, setShowSkillIndex] = useState(false);
  const files = startupFiles(props.records);
  const startup = estimate.startup + estimate.skillMetadata;
  const share = (value: number) =>
    `${(value / Math.max(startup, 1)) * percent}%`;
  return (
    <section aria-labelledby="startup-summary-title" className="mb-2 pt-1">
      <div className="flex items-center gap-x-4 text-label">
        <h2
          className="m-0 text-label font-normal text-ink-muted"
          id="startup-summary-title"
        >
          {props.title}
        </h2>
        {props.findings?.list.length ? (
          <button
            className="ml-auto inline-flex h-6 items-center gap-1.5 px-1.5 text-label underline decoration-dotted underline-offset-4 hover:bg-wash"
            onClick={props.findings.onOpen}
          >
            <FindingCounts findings={props.findings.list} />
            <PixelIcon name="arrow-right" />
          </button>
        ) : null}
      </div>
      <p className="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-7 gap-y-1 text-label text-ink-muted">
        <span>
          <strong className="mr-1 font-mono text-figure text-ink">
            {approxTokens(startup)}
          </strong>{" "}
          startup
        </span>
        <span>
          <strong className="mr-1 font-mono text-title text-ink">
            {approxTokens(estimate.onDemand)}
          </strong>{" "}
          on demand
        </span>
        {estimate.unaccountedSources ? (
          <span>{estimate.unaccountedSources} unmeasured</span>
        ) : null}
      </p>
      <div aria-hidden="true" className="mt-2 flex h-4 gap-1 overflow-hidden">
        {files.map((file) => (
          <span
            className={`${layerDots[file.layer]} ${file.id === props.selectedId ? "bg-accent" : "bg-ink"}`}
            key={file.id}
            style={{ width: share(file.startupTokens) }}
          />
        ))}
        <span
          className="dots-check bg-accent"
          style={{ width: share(estimate.skillMetadata) }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-label">
        <ol className="m-0 -ml-1.5 flex min-w-0 list-none flex-wrap gap-x-1.5 gap-y-0.5 p-0 text-ink-muted">
          {files.map((file) => (
            <li className="min-w-0" key={file.id}>
              <button
                aria-current={file.id === props.selectedId ? "true" : undefined}
                className={`inline-flex h-[22px] max-w-full items-center gap-[7px] px-1.5 ${file.id === props.selectedId ? "on-accent bg-accent" : "hover:bg-wash"}`}
                onClick={() => props.onSelect(file.id)}
              >
                <i
                  aria-hidden="true"
                  className={`inline-block size-3 shrink-0 ${layerDots[file.layer]} ${file.id === props.selectedId ? "bg-on-accent" : "bg-ink"}`}
                />
                <strong className="font-mono text-mono whitespace-nowrap text-ink">
                  {approxTokens(file.startupTokens)}
                </strong>
                <span className="truncate font-mono text-mono">
                  {loadPath(file, props.context)}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              aria-haspopup="dialog"
              className="inline-flex h-[22px] items-center gap-[7px] px-1.5 hover:bg-wash disabled:pointer-events-none"
              disabled={!estimate.skillMetadata}
              onClick={() => setShowSkillIndex(true)}
              title="See which skills and commands make up the skill index"
            >
              <i
                aria-hidden="true"
                className="dots-check inline-block size-3 shrink-0 bg-accent"
              />
              <strong className="font-mono text-mono text-ink">
                {approxTokens(estimate.skillMetadata)}
              </strong>
              Skill index
            </button>
          </li>
        </ol>
        <span className="ml-auto text-ink-faint">
          Estimated tokens: characters ÷ 4
        </span>
      </div>
      {showSkillIndex ? (
        <SkillIndexDialog
          onClose={() => setShowSkillIndex(false)}
          onSelect={(id) => {
            setShowSkillIndex(false);
            props.onSelect(id);
          }}
          records={props.records}
          tool={tool}
          total={estimate.skillMetadata}
        />
      ) : null}
    </section>
  );
}
