import type { InventoryRecord } from "./record-types";

/** Skills and agents with a file of their own can be copied into another project. */
export function canCopy(record: InventoryRecord): boolean {
  return (
    Boolean(record.sourceRef) &&
    (record.kind === "skill" || record.kind === "agent")
  );
}

/** Plugin and managed items belong to someone else; the server refuses them too. */
export function canDelete(record: InventoryRecord): boolean {
  return canCopy(record) && !record.plugin && record.layer !== "managed";
}
