import type { InventoryRecord } from "./record-types";

/** A file the app can open in its editor: one with a scan to act through, that could be read. */
export function canEdit(record: InventoryRecord): boolean {
  return Boolean(record.sourceRef) && !record.unreadable;
}

/** Skills and agents with a readable file of their own can be copied into another project. */
export function canCopy(record: InventoryRecord): boolean {
  return (
    canEdit(record) && (record.kind === "skill" || record.kind === "agent")
  );
}

/** Any skill or agent of the user's own, broken links included; plugin and managed items belong to someone else. */
export function canDelete(record: InventoryRecord): boolean {
  return (
    Boolean(record.sourceRef) &&
    (record.kind === "skill" || record.kind === "agent") &&
    !record.plugin &&
    record.layer !== "managed"
  );
}
