import type {
  InventoryRecord,
  Layer,
  RecordKind
} from "../../model/record-types";
import { kindOrder } from "../../ui/kind-icon";

/** Configuration stacks from organization policy down to personal overrides. */
const stack: readonly Layer[] = [
  "managed",
  "global",
  "plugins",
  "project",
  "user"
];

interface KindGroup {
  kind: RecordKind;
  records: InventoryRecord[];
}

export interface MapLayer {
  layer: Layer;
  kinds: KindGroup[];
  plugins: InventoryRecord[];
  hiddenPlugins: number;
  /** Cached, disabled, or unconfirmed duplicate versions, counted whether or not they are shown. */
  backgroundPlugins: number;
}

function kindGroups(records: InventoryRecord[]): KindGroup[] {
  return kindOrder
    .filter((kind) => kind !== "plugin")
    .map((kind) => ({
      kind,
      records: records
        .filter((record) => record.kind === kind)
        .sort((a, b) => a.order - b.order)
    }))
    .filter((group) => group.records.length > 0);
}

/**
 * A plugin version is a candidate, not a contribution, when it is inactive or when its selection is
 * unknown while another version of the same plugin is selected.
 */
function isBackgroundVersion(
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

const tierRank = {
  active: 0,
  approval: 1,
  unknown: 2,
  problem: 3,
  inactive: 4
} satisfies Record<InventoryRecord["tier"], number>;

/** Plugins in display order: selected first, candidates and cached versions after. */
function pluginsFor(allPlugins: InventoryRecord[], showInactive: boolean) {
  const plugins = allPlugins
    .filter(
      (plugin) => showInactive || !isBackgroundVersion(plugin, allPlugins)
    )
    .sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);
  const backgroundPlugins = allPlugins.filter((plugin) =>
    isBackgroundVersion(plugin, allPlugins)
  ).length;
  return {
    plugins,
    hiddenPlugins: allPlugins.length - plugins.length,
    backgroundPlugins
  };
}

/** Layers for one tool. Managed appears only when something is managed; inactive items only on request. */
export function buildMap(
  records: readonly InventoryRecord[],
  showInactive: boolean
): MapLayer[] {
  const shown = records.filter(
    (record) => showInactive || record.tier !== "inactive"
  );
  return stack
    .filter(
      (layer) =>
        layer !== "managed" ||
        records.some((record) => record.layer === "managed")
    )
    .map((layer) => {
      const allPlugins = records.filter(
        (record) => record.kind === "plugin" && record.layer === layer
      );
      return {
        layer,
        kinds: kindGroups(
          shown.filter(
            (record) =>
              record.layer === layer &&
              record.kind !== "plugin" &&
              !record.plugin
          )
        ),
        ...pluginsFor(allPlugins, showInactive)
      };
    });
}

/** 1-based position of each instruction in the tool's startup load order. */
export function loadOrder(
  records: readonly InventoryRecord[]
): Map<string, number> {
  const startup = records
    .filter(
      (record) =>
        record.kind === "instruction" &&
        record.tier === "active" &&
        record.loading === "startup"
    )
    .sort((a, b) => a.order - b.order);
  return new Map(startup.map((record, index) => [record.id, index + 1]));
}

const thousand = 1000;
const wholeThousands = 10_000;

/** Token estimates are approximate by definition, so they always carry "~". */
export function approxTokens(value: number): string {
  if (value < thousand) {
    return `~${value}`;
  }
  const digits = value >= wholeThousands ? 0 : 1;
  return `~${(value / thousand).toFixed(digits)}k`;
}

/** Startup instruction files that contribute to the startup estimate, in load order. */
export function startupFiles(
  records: readonly InventoryRecord[]
): InventoryRecord[] {
  const order = loadOrder(records);
  return records
    .filter((record) => order.has(record.id) && record.startupTokens > 0)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
