import type { InventoryRecord } from "./record-types";

/**
 * A plugin version is a candidate, not a contribution, when it is inactive or when its selection is
 * unknown while another version of the same plugin is selected.
 */
export function isBackgroundVersion(
  plugin: InventoryRecord,
  plugins: readonly InventoryRecord[]
): boolean {
  if (plugin.tier === "inactive") {
    return true;
  }
  return (
    plugin.tier === "unknown" &&
    plugins.some(
      (other) => other.name === plugin.name && other.tier === "active"
    )
  );
}

export interface InactiveFold {
  hidden(record: InventoryRecord): boolean;
  /** Background versions per plugin name. */
  otherVersions: ReadonlyMap<string, number>;
}

/**
 * Records hidden until Show inactive: inactive items, background plugin versions and what those versions
 * declare. `otherVersions` counts the background versions per plugin name, so the shown row can mention them.
 * Expects one tool's records.
 */
export function foldInactive(
  records: readonly InventoryRecord[]
): InactiveFold {
  const plugins = records.filter((record) => record.kind === "plugin");
  const background = new Set(
    plugins
      .filter((plugin) => isBackgroundVersion(plugin, plugins))
      .map((plugin) => plugin.id)
  );
  const otherVersions = new Map<string, number>();
  for (const plugin of plugins) {
    if (background.has(plugin.id)) {
      otherVersions.set(plugin.name, (otherVersions.get(plugin.name) ?? 0) + 1);
    }
  }
  const hidden = (record: InventoryRecord) =>
    record.tier === "inactive" ||
    background.has(record.id) ||
    background.has(record.plugin?.id ?? "");
  return { hidden, otherVersions };
}
