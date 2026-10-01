import type { ToolId } from "@agent-mapper/core";
import { isInside } from "../../model/paths";
import type { InventoryRecord, RecordKind } from "../../model/record-types";
import { recordKey, type ScannedProject } from "../../model/scanned-project";
import { stateText } from "../../model/states";
import { kindCounts } from "../inventory-groups";

/** Memory is matched per project by the tool itself, so it is not a global source a project can differ on. */
const comparedKinds: readonly RecordKind[] = [
  "instruction",
  "skill",
  "command",
  "agent",
  "hook",
  "mcp",
  "plugin"
];

export interface Difference {
  /** The source as the global scan sees it. */
  source: InventoryRecord;
  /** The same source as this project's scan sees it; undefined when the scan does not list it. */
  match?: InventoryRecord;
}

export interface DifferenceGroup {
  /** The state the sources have in this project, e.g. "Disabled". */
  state: string;
  items: Difference[];
}

const notReached = "Does not reach";

/**
 * Global sources that apply globally but not, or not plainly, in this project, grouped by their state there.
 * Plugin contributions follow their plugin, so the plugin stands for them. Empty until the project is scanned.
 */
export function differencesFromGlobal(
  globalRecords: readonly InventoryRecord[],
  project: ScannedProject
): DifferenceGroup[] {
  const { records } = project;
  if (!records) {
    return [];
  }
  const byKey = new Map(records.map((record) => [recordKey(record), record]));
  const groups = new Map<string, Difference[]>();
  for (const source of globalRecords) {
    const compared =
      source.tier === "active" &&
      !source.plugin &&
      comparedKinds.includes(source.kind);
    const match = byKey.get(recordKey(source));
    if (compared && match?.tier !== "active") {
      const state = match ? stateText(match) : notReached;
      groups.set(state, [...(groups.get(state) ?? []), { source, match }]);
    }
  }
  return [...groups].map(([state, items]) => ({ state, items }));
}

/** What the project adds on its own, by kind. */
export function projectOwn(
  project: ScannedProject,
  showInactive: boolean
): [RecordKind, number][] {
  return kindCounts(
    (project.records ?? []).filter(
      (record) =>
        (record.layer === "project" || record.layer === "user") &&
        isInside(record.path, project.path) &&
        (showInactive || record.tier !== "inactive")
    )
  );
}

/** Estimated tokens a fresh session in the project starts with: instruction files plus the skill index. */
export function startupTokens(
  project: ScannedProject,
  tool: ToolId
): number | undefined {
  const estimate = project.context?.[tool];
  return estimate && estimate.startup + estimate.skillMetadata;
}
