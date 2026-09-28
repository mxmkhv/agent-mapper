import { isInside } from "../../model/paths";
import type { InventoryRecord, RecordKind } from "../../model/record-types";
import { kindOrder } from "../../ui/kind-icon";

export interface ReachProject {
  name: string;
  path: string;
  /** Undefined while the project is still scanning or when its scan failed. */
  records?: InventoryRecord[];
  error?: string;
}

export interface ReachRow {
  record: InventoryRecord;
  cells: (InventoryRecord | undefined)[];
}

export interface ReachSection {
  kind: RecordKind;
  varying: ReachRow[];
  /** Rows that reach every project the same way; collapsed by default because they carry no news. */
  uniform: ReachRow[];
}

const sectionKinds: readonly RecordKind[] = [
  "instruction",
  "plugin",
  "mcp",
  "hook",
  "agent"
];

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

function cellsFor(record: InventoryRecord, projects: readonly ReachProject[]) {
  const key = recordKey(record);
  return projects.map((project) =>
    project.records?.find((item) => recordKey(item) === key)
  );
}

/**
 * Sources outside any project: global declarations, plus instruction files in parent folders
 * and plugins that a project enables for itself.
 */
function outsideSources(
  globalRecords: readonly InventoryRecord[],
  projects: readonly ReachProject[]
) {
  const seen = new Map(
    globalRecords.map((record) => [recordKey(record), record])
  );
  for (const project of projects) {
    for (const record of project.records ?? []) {
      const aboveRepo =
        record.kind === "instruction" && !isInside(record.path, project.path);
      const projectPlugin =
        record.kind === "plugin" && record.scope === "project";
      if ((aboveRepo || projectPlugin) && !seen.has(recordKey(record))) {
        seen.set(recordKey(record), record);
      }
    }
  }
  return [...seen.values()];
}

export function buildReach(
  globalRecords: readonly InventoryRecord[],
  scope: { projects: readonly ReachProject[]; showInactive: boolean }
): ReachSection[] {
  const { projects, showInactive } = scope;
  const sources = outsideSources(globalRecords, projects).filter(
    (record) => sectionKinds.includes(record.kind) && !record.plugin
  );
  return sectionKinds
    .map((kind) => {
      const rows = sources
        .filter((record) => record.kind === kind)
        .map((record) => ({ record, cells: cellsFor(record, projects) }))
        .filter(
          (row) =>
            showInactive ||
            [row.record, ...row.cells].some(
              (cell) => cell && cell.tier !== "inactive"
            )
        );
      const scanned = (index: number) => projects[index]?.records !== undefined;
      const isUniform = (row: ReachRow) =>
        row.cells.every(
          (cell, index) => !scanned(index) || cell?.tier === "active"
        );
      return {
        kind,
        varying: rows.filter((row) => !isUniform(row)),
        uniform: rows.filter(isUniform)
      };
    })
    .filter((section) => section.varying.length + section.uniform.length > 0);
}

/** How many of the global skills each project actually receives. */
export function skillReach(
  globalRecords: readonly InventoryRecord[],
  projects: readonly ReachProject[]
) {
  const skills = globalRecords.filter(
    (record) => record.kind === "skill" && !record.plugin
  );
  const counts = projects.map((project) => {
    const active = new Set(
      (project.records ?? [])
        .filter((record) => record.tier === "active")
        .map(recordKey)
    );
    return skills.filter((skill) => active.has(recordKey(skill))).length;
  });
  return { total: skills.length, counts };
}

/** What each project adds on its own, by kind. */
export function projectOwn(
  projects: readonly ReachProject[],
  showInactive: boolean
) {
  return kindOrder
    .filter((kind) => kind !== "plugin")
    .map((kind) => ({
      kind,
      counts: projects.map(
        (project) =>
          (project.records ?? []).filter(
            (record) =>
              record.kind === kind &&
              (record.layer === "project" || record.layer === "user") &&
              isInside(record.path, project.path) &&
              (showInactive || record.tier !== "inactive")
          ).length
      )
    }))
    .filter((row) => row.counts.some(Boolean));
}
