import type { InventoryRecord } from "./record-types";

/** Names that repeat within a group, so their rows or chips can show what tells them apart. */
export function repeatedNames(records: readonly InventoryRecord[]) {
  const seen = new Map<string, number>();
  for (const record of records) {
    seen.set(record.name, (seen.get(record.name) ?? 0) + 1);
  }
  return new Set(
    [...seen].filter(([, count]) => count > 1).map(([name]) => name)
  );
}
