import type { ToolId } from "@agent-mapper/core";
import type { InventoryRecord } from "./record-types";

/** Instruction files a fresh session reads at startup, in the order the tool loads them. */
export function startupFiles(
  records: readonly InventoryRecord[]
): InventoryRecord[] {
  return records
    .filter(
      (record) =>
        record.kind === "instruction" &&
        record.tier === "active" &&
        record.loading === "startup"
    )
    .sort((a, b) => a.order - b.order);
}

/** The skills and commands behind the skill index, largest first. */
export function skillIndexRecords(
  records: readonly InventoryRecord[],
  tool: ToolId
): InventoryRecord[] {
  return records
    .filter(
      (record) =>
        record.tool === tool && record.skillIndexCharacters !== undefined
    )
    .sort(
      (a, b) =>
        (b.skillIndexCharacters ?? 0) - (a.skillIndexCharacters ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

const thousand = 1000;
const wholeThousands = 10_000;

/** Token estimates are approximate by definition, so they always carry "~". */
export function approxTokens(value: number): string {
  if (value < thousand) {
    return `~${value}`;
  }
  const digits = value >= wholeThousands ? 0 : 1;
  return `~${(value / thousand).toFixed(digits)}k`;
}
