import type { ContextSummary, ToolId } from "@agent-mapper/core";
import { layerLabel } from "../../model/layers";
import type { InventoryRecord, Layer } from "../../model/record-types";
import { approxTokens, startupFiles } from "./map-model";

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

interface BudgetProps {
  context: ContextSummary;
  tool: ToolId;
  records: InventoryRecord[];
}

/** Startup = instruction files plus the skill index. On demand is what could load later, not what will. */
export function StartupBudget({ context, tool, records }: BudgetProps) {
  const estimate = context[tool];
  const files = startupFiles(records);
  const startup = estimate.startup + estimate.skillMetadata;
  const share = (value: number) =>
    `${(value / Math.max(startup, 1)) * percent}%`;
  return (
    <div className="mt-2.5">
      <div
        className="flex flex-wrap gap-4 text-label text-ink-muted"
        title="Characters ÷ 4, not billed tokens"
      >
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
      </div>
      <div
        className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-wash"
        aria-hidden="true"
      >
        {files.map((file) => (
          <span
            className={layerTone[file.layer]}
            key={file.id}
            style={{ width: share(file.startupTokens) }}
            title={`${file.name} ${approxTokens(file.startupTokens)}`}
          />
        ))}
        <span
          className={`${skillTone[tool]} opacity-55`}
          style={{ width: share(estimate.skillMetadata) }}
          title={`Skill index ${approxTokens(estimate.skillMetadata)}`}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
        {files.map((file) => (
          <span className="inline-flex items-center gap-1.5" key={file.id}>
            <i
              className={`inline-block size-2 rounded-[2px] ${layerTone[file.layer]}`}
            />
            {file.name} · {layerLabel[file.layer].toLocaleLowerCase()}{" "}
            {approxTokens(file.startupTokens)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i
            className={`inline-block size-2 rounded-[2px] opacity-55 ${skillTone[tool]}`}
          />
          Skill index {approxTokens(estimate.skillMetadata)}
        </span>
      </div>
    </div>
  );
}
