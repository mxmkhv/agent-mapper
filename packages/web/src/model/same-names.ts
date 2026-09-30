import { tildePath, type PathContext } from "./paths";
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

/**
 * For names that repeat within a group, the nearest folder that tells the copies apart: two
 * `skills/react-render-skill/SKILL.md` files differ at `.agents` and `.codex`, not at their own folder.
 * When that folder name is itself shared (`~/.claude` and `~/app/.claude`), the path up to it is shown instead.
 * Copies with identical paths get no label.
 */
export function telltaleFolders(
  records: readonly InventoryRecord[],
  context: PathContext
): Map<string, string> {
  const result = new Map<string, string>();
  for (const name of repeatedNames(records)) {
    const copies = records.filter((record) => record.name === name);
    // Folder segments nearest first, so index 0 is the folder holding the file.
    const folders = copies.map((record) =>
      record.path.split("/").slice(0, -1).reverse()
    );
    const deepest = Math.max(...folders.map((segments) => segments.length));
    const level = Array.from({ length: deepest }, (_, index) => index).find(
      (index) => new Set(folders.map((segments) => segments[index])).size > 1
    );
    if (level === undefined) {
      continue;
    }
    const names = folders.map((segments) => segments[level] ?? "/");
    const distinct = new Set(names).size === names.length;
    copies.forEach((record, index) => {
      const segments = folders[index] ?? [];
      result.set(
        record.id,
        distinct
          ? (names[index] ?? "/")
          : tildePath(segments.slice(level).reverse().join("/") || "/", context)
      );
    });
  }
  return result;
}
