import type { Finding } from "@agent-mapper/core";
import type { InventoryRecord } from "./record-types";

export interface Precedence {
  /** The next source that wins over this one. It may itself be shadowed by another. */
  overriddenBy?: InventoryRecord;
  /** Sources this one wins over. */
  overrides: InventoryRecord[];
  /** Other skill files that declare the same name, so listings cannot tell them apart. */
  sameName: InventoryRecord[];
}

/** The Global view merges several projects' records, so the same source can appear more than once. */
function unique(records: InventoryRecord[]): InventoryRecord[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function sameNameIds(
  record: InventoryRecord,
  findings: readonly Finding[]
): Set<string> {
  return new Set(
    findings
      .filter(
        (finding) =>
          finding.code === "duplicate-skill-name" &&
          finding.sources.some((source) => source.id === record.id)
      )
      .flatMap((finding) => finding.sources.map((source) => source.id))
      .filter((id) => id !== record.id)
  );
}

/** How a record relates to the others that compete with it, from the resolver's own links. */
export function precedenceOf(
  record: InventoryRecord,
  scope: {
    records: readonly InventoryRecord[];
    findings: readonly Finding[];
  }
): Precedence {
  const names = sameNameIds(record, scope.findings);
  return {
    overriddenBy: scope.records.find((item) => item.id === record.shadowedBy),
    overrides: unique(
      scope.records.filter((item) => item.shadowedBy === record.id)
    ),
    sameName: unique(scope.records.filter((item) => names.has(item.id)))
  };
}

/** Records grouped by the id of the record that wins over them, each source once. */
function losersByWinner(records: readonly InventoryRecord[]) {
  const losers = new Map<string, Map<string, InventoryRecord>>();
  for (const record of records) {
    if (record.shadowedBy) {
      const group = losers.get(record.shadowedBy) ?? new Map();
      losers.set(record.shadowedBy, group.set(record.id, record));
    }
  }
  return losers;
}

/**
 * Short row labels for records that would otherwise look normal: the winner of an override, and skills that
 * share a name. An overridden record already carries its own state label. One pass over the records, since
 * it runs for every row the Inventory shows.
 */
export function relationLabels(scope: {
  records: readonly InventoryRecord[];
  findings: readonly Finding[];
}): Map<string, string> {
  const losers = losersByWinner(scope.records);
  const sharedNames = new Set(
    scope.findings
      .filter((finding) => finding.code === "duplicate-skill-name")
      .flatMap((finding) => finding.sources.map((source) => source.id))
  );
  const labels = new Map<string, string>();
  for (const record of scope.records) {
    const overrides = [...(losers.get(record.id)?.values() ?? [])];
    const [only] = overrides;
    if (only) {
      labels.set(
        record.id,
        overrides.length === 1
          ? `overrides ${only.name}`
          : `overrides ${overrides.length}`
      );
    } else if (sharedNames.has(record.id)) {
      labels.set(record.id, "shared name");
    }
  }
  return labels;
}
