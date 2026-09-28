import type { ContextSummary, ToolId } from "@agent-mapper/core";
import { layerHint, layerLabel } from "../../model/layers";
import type { PathContext } from "../../model/paths";
import type { InventoryRecord, RecordKind } from "../../model/record-types";
import { stateText } from "../../model/states";
import { KindIcon, kindLabel, kindOrder } from "../../ui/kind-icon";
import { StateMarker, ToolGlyph, toolName } from "../../ui/marks";
import { chipClass, ChipRow, repeatedNames } from "./map-items";
import { buildMap, loadOrder, type MapLayer } from "./map-model";
import { StartupBudget } from "./startup-budget";

interface MapViewProps {
  records: InventoryRecord[];
  tool: ToolId;
  estimate: ContextSummary;
  context: PathContext;
  showInactive: boolean;
  selectedId?: string;
  onSelect(id: string): void;
  onKind(kind: RecordKind): void;
  onToggleInactive(): void;
}

function Contributions({ plugin }: { plugin: InventoryRecord }) {
  return kindOrder.map((kind) => {
    const count = plugin.contributions?.[kind];
    return count ? (
      <span
        className="inline-flex items-center gap-0.5 text-caption text-ink-faint"
        key={kind}
        title={kindLabel[kind]}
      >
        <KindIcon kind={kind} small />
        {count}
      </span>
    ) : null;
  });
}

function PluginChips({
  layer,
  props
}: {
  layer: MapLayer;
  props: MapViewProps;
}) {
  if (!layer.plugins.length && !layer.backgroundPlugins) {
    return null;
  }
  const selected = layer.plugins.filter(
    (plugin) => plugin.tier === "active"
  ).length;
  const repeated = repeatedNames(layer.plugins);
  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-1.5 px-2 py-2">
      <span className="pt-0.5">
        <KindIcon kind="plugin" />
      </span>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-1.5 text-label text-ink-muted">
          <strong className="font-semibold text-ink">Plugins</strong>
          {selected} selected
        </div>
        <div className="flex flex-wrap gap-1">
          {layer.plugins.map((plugin) => (
            <button
              className={`inline-flex h-6 items-center gap-1.5 rounded-control border px-2 text-label hover:border-hairline-strong ${chipClass(plugin, props.selectedId)}`}
              key={plugin.id}
              onClick={() => props.onSelect(plugin.id)}
              title={`${plugin.name} ${plugin.summary ?? ""} · ${stateText(plugin)}`}
            >
              {plugin.tier === "active" ? null : (
                <StateMarker tier={plugin.tier} />
              )}
              {plugin.name}
              {repeated.has(plugin.name) ? (
                <span className="font-mono text-caption text-ink-faint">
                  {plugin.summary}
                </span>
              ) : null}
              <Contributions plugin={plugin} />
            </button>
          ))}
        </div>
        {layer.backgroundPlugins ? (
          <p className="mt-1.5 mb-0 text-caption text-ink-faint">
            {props.showInactive ? "Showing " : ""}
            {layer.backgroundPlugins} other{" "}
            {layer.backgroundPlugins === 1 ? "version" : "versions"}
            {props.showInactive ? "" : " hidden"} ·{" "}
            <button
              className="text-ink-muted underline underline-offset-2"
              onClick={props.onToggleInactive}
            >
              {props.showInactive ? "hide" : "show"}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  props,
  order
}: {
  layer: MapLayer;
  props: MapViewProps;
  order: Map<string, number>;
}) {
  const hint = layerHint(layer.layer, {
    records: props.records,
    context: props.context,
    tool: props.tool
  });
  const empty =
    !layer.kinds.length && !layer.plugins.length && !layer.backgroundPlugins;
  return (
    // Each layer is its own row, so its sticky label scrolls away with the layer instead of stacking.
    <section className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 border-t border-hairline">
      <div className="sticky top-0 self-start bg-canvas pt-3.5 pb-2">
        <strong className="block text-label font-semibold">
          {layerLabel[layer.layer]}
        </strong>
        {hint.split(" · ").map((part) => (
          <span
            className="mt-0.5 block font-mono text-caption break-words text-ink-faint"
            key={part}
          >
            {part}
          </span>
        ))}
      </div>
      <div className="min-w-0 pt-2.5 pb-3.5">
        {empty ? (
          <p className="m-0 px-3 py-2 text-label text-ink-faint">
            Nothing at this layer
          </p>
        ) : (
          <div className="max-w-[860px] rounded-card border border-hairline bg-surface p-1">
            <PluginChips layer={layer} props={props} />
            {layer.kinds.map((group) => (
              <ChipRow
                context={props.context}
                key={group.kind}
                kind={group.kind}
                onMore={props.onKind}
                onSelect={props.onSelect}
                order={order}
                records={group.records}
                selectedId={props.selectedId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** One tool's configuration as a stack: where each piece lives and what loads first. */
export function MapView(props: MapViewProps) {
  const layers = buildMap(props.records, props.showInactive);
  const order = loadOrder(props.records);
  return (
    <div className="px-5 pt-4 pb-10">
      <div className="ml-[104px] max-w-[860px] px-1 pb-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          <ToolGlyph tool={props.tool} />
          {toolName[props.tool]}
        </div>
        <StartupBudget
          context={props.estimate}
          records={props.records}
          tool={props.tool}
        />
      </div>
      {layers.map((layer) => (
        <LayerRow key={layer.layer} layer={layer} order={order} props={props} />
      ))}
    </div>
  );
}
