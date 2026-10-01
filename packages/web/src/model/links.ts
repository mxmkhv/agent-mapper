import type { InventoryRecord } from "./record-types";

/** Plugin folders are install locations, not links a person created. */
export function isLink(record: InventoryRecord): boolean {
  return record.kind !== "plugin" && record.realPath !== record.path;
}

/** The record for the file a symlink resolves to, preferring the same tool. */
export function linkTarget(
  record: InventoryRecord,
  records: readonly InventoryRecord[]
): InventoryRecord | undefined {
  const matches = records.filter((item) => item.path === record.realPath);
  return matches.find((item) => item.tool === record.tool) ?? matches[0];
}

/** Every entry whose file resolves to this record's path. */
export function linkedFrom(
  record: InventoryRecord,
  records: readonly InventoryRecord[]
): InventoryRecord[] {
  const seen = new Set<string>();
  return records.filter((item) => {
    const key = `${item.tool}|${item.path}`;
    const links =
      item.id !== record.id &&
      item.realPath === record.path &&
      item.path !== record.path &&
      !seen.has(key);
    // Global view merges several projects' records, so the same link can appear more than once.
    if (links) {
      seen.add(key);
    }
    return links;
  });
}
