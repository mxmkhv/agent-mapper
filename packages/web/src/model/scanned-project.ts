import type { ContextSummary, Finding } from "@agent-mapper/core";
import type { InventoryRecord } from "./record-types";

/** One project's scan as the Global view sees it. */
export interface ScannedProject {
  name: string;
  path: string;
  /** Undefined until a scan answers with records, or when the latest answered scan failed; see `refreshing`. */
  records?: InventoryRecord[];
  context?: ContextSummary;
  findings?: Finding[];
  error?: string;
  /** The records or error are from the previous scan; a rescan is still running. */
  refreshing?: boolean;
}

/** The project's current scan has answered with records. */
export const scanSettled = (project: ScannedProject): boolean =>
  project.records !== undefined && !project.refreshing;

/** The project's current scan failed. */
export const scanFailed = (project: ScannedProject): boolean =>
  project.error !== undefined && !project.refreshing;

/** No current answer yet: never scanned, or rescanning. */
export const scanPending = (project: ScannedProject): boolean =>
  Boolean(project.refreshing) ||
  (project.records === undefined && project.error === undefined);

/** Stable identity for the same declaration seen from different folders. */
export function recordKey(record: InventoryRecord): string {
  return [
    record.tool,
    record.kind,
    record.path,
    record.locator ?? "",
    record.summary ?? ""
  ].join("|");
}
