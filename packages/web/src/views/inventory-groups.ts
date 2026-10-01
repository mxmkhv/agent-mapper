import { layerLabel } from "../model/layers";
import type { InventoryRecord, Layer, RecordKind } from "../model/record-types";
import { kindOrder } from "../ui/kind-icon";

export interface InventoryGroup {
  key: string;
  label: string;
  layer: Layer;
  plugin?: { name: string; version?: string };
  records: InventoryRecord[];
}

/** Groups follow the layer stack: Global, installed plugins, each plugin's contributions, Project, User. */
const layerRank = {
  managed: 0,
  global: 1,
  plugins: 3,
  project: 4,
  user: 5
} satisfies Record<Layer, number>;
const installedRank = 2;

function groupFor(record: InventoryRecord): Omit<InventoryGroup, "records"> {
  if (record.kind === "plugin") {
    return {
      key: "installed-plugins",
      label: "Installed plugins",
      layer: "plugins"
    };
  }
  if (record.plugin) {
    const { name, version } = record.plugin;
    return {
      key: `plugin:${record.plugin.id}`,
      label: name,
      layer: "plugins",
      plugin: { name, version }
    };
  }
  return {
    key: record.layer,
    label: layerLabel[record.layer],
    layer: record.layer
  };
}

/** Project and user layers belong to the open project; every other layer comes from outside it. */
export function isLocalGroup(group: InventoryGroup): boolean {
  return group.layer === "project" || group.layer === "user";
}

export interface SharedSource {
  repo: string;
  count: number;
}

/** Repos that several of the group's skills were installed from, largest first; one-off sources are left out. */
export function sharedSources(
  records: readonly InventoryRecord[]
): SharedSource[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    const repo = record.installedFrom?.repo;
    if (repo) {
      counts.set(repo, (counts.get(repo) ?? 0) + 1);
    }
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo));
}

/** A repo shared by several skills in a group; `tone` is its rank among them, which picks its dot color. */
export interface ClusterSource extends SharedSource {
  tone: number;
}

export interface RowCluster {
  /** Set when the rows are skills from one shared repo. */
  source?: ClusterSource;
  records: InventoryRecord[];
}

/** A group's rows in display order, with each shared repo's skills gathered where the first of them sits. */
export function clusterBySource(
  records: readonly InventoryRecord[]
): RowCluster[] {
  const shared = new Map<string, ClusterSource>(
    sharedSources(records).map((source, tone) => [
      source.repo,
      { ...source, tone }
    ])
  );
  const clusters = new Map<string, RowCluster>();
  for (const record of records) {
    const repo = record.installedFrom?.repo;
    const source = repo ? shared.get(repo) : undefined;
    const key = source?.repo ?? record.id;
    const cluster = clusters.get(key) ?? { source, records: [] };
    cluster.records.push(record);
    clusters.set(key, cluster);
  }
  return [...clusters.values()];
}

function rank(group: InventoryGroup): number {
  return group.key === "installed-plugins"
    ? installedRank
    : layerRank[group.layer];
}

function byKindThenName(a: InventoryRecord, b: InventoryRecord): number {
  return (
    kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
    a.name.localeCompare(b.name)
  );
}

export function groupRecords(
  records: readonly InventoryRecord[]
): InventoryGroup[] {
  const groups = new Map<string, InventoryGroup>();
  for (const record of records) {
    const group = groupFor(record);
    const existing = groups.get(group.key) ?? { ...group, records: [] };
    existing.records.push(record);
    groups.set(group.key, existing);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      records: [...group.records].sort(byKindThenName)
    }))
    .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

export function kindCounts(
  records: readonly InventoryRecord[]
): [RecordKind, number][] {
  const counts = new Map<RecordKind, number>();
  for (const record of records) {
    counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  }
  return kindOrder.flatMap((kind) => {
    const count = counts.get(kind);
    return count ? [[kind, count] as [RecordKind, number]] : [];
  });
}
