import type { InventoryRecord } from "../model/record-types";

const resultLimit = 40;

/** Every term must match the name, path, or kind. Inactive records sort after active ones. */
export function searchRecords(
  records: readonly InventoryRecord[],
  query: string
): InventoryRecord[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records
    .filter((record) => {
      const haystack =
        `${record.name} ${record.path} ${record.kind} ${record.plugin?.name ?? ""}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort(
      (a, b) =>
        Number(a.tier === "inactive") - Number(b.tier === "inactive") ||
        a.name.localeCompare(b.name)
    )
    .slice(0, resultLimit);
}
