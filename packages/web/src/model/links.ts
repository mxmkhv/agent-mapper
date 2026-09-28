import type { InventoryRecord } from "./record-types";

/** A skill lives at `<folder>/<name>/SKILL.md`, so its shared folder is two segments up. */
const folderDepth = 2;

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
  return records.filter(
    (item) =>
      item.id !== record.id &&
      item.realPath === record.path &&
      item.path !== record.path
  );
}

function targetFolder(record: InventoryRecord): string | undefined {
  if (!isLink(record)) {
    return undefined;
  }
  return record.realPath.split("/").slice(0, -folderDepth).join("/");
}

/** When several items link into one folder, the group says it once instead of on every item. */
export function sharedLinkFolder(
  records: readonly InventoryRecord[]
): { folder: string; count: number } | undefined {
  const counts = new Map<string, number>();
  for (const record of records) {
    const folder = targetFolder(record);
    if (folder) {
      counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return best && best[1] > 1 ? { folder: best[0], count: best[1] } : undefined;
}
