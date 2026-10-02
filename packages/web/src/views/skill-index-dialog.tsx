import { tokenEstimate, type ToolId } from "@agent-mapper/core";
import { layerLabel } from "../model/layers";
import type { InventoryRecord } from "../model/record-types";
import { approxTokens, skillIndexRecords } from "../model/startup";
import { KindIcon } from "../ui/kind-icon";
import { Modal } from "../ui/modal";

export const skillTone = {
  claude: "bg-claude",
  codex: "bg-codex"
} satisfies Record<ToolId, string>;

const percent = 100;

interface SkillIndexDialogProps {
  tool: ToolId;
  records: readonly InventoryRecord[];
  /** The summary's figure, so the dialog and the bar never disagree. */
  total: number;
  onSelect(id: string): void;
  onClose(): void;
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function countText(records: readonly InventoryRecord[]): string {
  const skills = records.filter((record) => record.kind === "skill").length;
  const commands = records.length - skills;
  return [
    skills ? counted(skills, "skill") : undefined,
    commands ? counted(commands, "command") : undefined
  ]
    .filter(Boolean)
    .join(" and ");
}

/** Where a skill comes from: its plugin, or the layer it sits in. */
function sourceText(record: InventoryRecord): string {
  return record.plugin?.name ?? layerLabel[record.layer];
}

/** The skill index, split by skill and command, largest first. Choosing one opens it in the inspector. */
export function SkillIndexDialog(props: SkillIndexDialogProps) {
  const rows = skillIndexRecords(props.records, props.tool).map((record) => ({
    record,
    tokens: tokenEstimate(record.skillIndexCharacters ?? 0)
  }));
  const largest = Math.max(1, ...rows.map((row) => row.tokens));
  // A source column that says the same thing on every row is noise; it appears once plugins or layers mix.
  const mixedSources =
    new Set(rows.map((row) => sourceText(row.record))).size > 1;
  return (
    <Modal onClose={props.onClose} title="Skill index">
      <p className="m-0 text-body text-ink-muted">
        Every session starts with the frontmatter (name and description) of each
        skill and command below, so the model knows when to use one. The rest of
        the file loads only when it is used.
      </p>
      <p className="m-0 flex items-baseline justify-between gap-3 text-label text-ink-muted">
        <span>
          <strong className="text-large font-semibold text-ink tabular-nums">
            {approxTokens(props.total)}
          </strong>{" "}
          across {countText(rows.map((row) => row.record))}
        </span>
        <span className="text-caption text-ink-faint">
          Estimated tokens: characters ÷ 4
        </span>
      </p>
      <ul className="m-0 -mx-2 list-none p-0">
        {rows.map(({ record, tokens }) => (
          <li key={record.id}>
            <button
              className={`grid h-9 w-full items-center ${mixedSources ? "grid-cols-[3.25rem_auto_minmax(0,1fr)_auto_4rem]" : "grid-cols-[3.25rem_auto_minmax(0,1fr)_4rem]"} gap-2 rounded-control px-2 text-left text-label hover:bg-hover`}
              onClick={() => props.onSelect(record.id)}
              type="button"
            >
              <strong className="text-right font-semibold text-ink tabular-nums">
                {approxTokens(tokens)}
              </strong>
              <KindIcon kind={record.kind} small />
              <span className="truncate text-ink">{record.name}</span>
              {mixedSources ? (
                <span className="truncate text-caption text-ink-faint">
                  {sourceText(record)}
                </span>
              ) : null}
              <span
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-wash"
              >
                <span
                  className={`block h-full rounded-full opacity-55 ${skillTone[props.tool]}`}
                  style={{ width: `${(tokens / largest) * percent}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
