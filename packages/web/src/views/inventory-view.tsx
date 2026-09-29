import type { ReactNode } from "react";
import { Layers, Plug } from "lucide-react";
import type { PathContext } from "../model/paths";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { KindIcon, kindLabel } from "../ui/kind-icon";
import {
  groupRecords,
  kindCounts,
  type InventoryGroup
} from "./inventory-groups";
import { InventoryRow } from "./inventory-row";

interface InventoryViewProps {
  records: InventoryRecord[];
  kind: RecordKind | "all";
  selectedId?: string;
  context: PathContext;
  hintFor(group: InventoryGroup): string | undefined;
  onKind(kind: RecordKind | "all"): void;
  onSelect(id: string): void;
}

function Facet({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-button border bg-surface px-2.5 text-label font-semibold ${active ? "border-ink text-ink" : "border-hairline text-ink-muted hover:border-hairline-strong"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GroupHead({ group, hint }: { group: InventoryGroup; hint?: string }) {
  const Icon = group.plugin ? Plug : Layers;
  return (
    <div className="flex h-[30px] items-center gap-2 px-2.5 text-label font-semibold text-ink-muted">
      <Icon
        aria-hidden="true"
        className="size-3.5 text-ink-faint"
        strokeWidth={1.6}
      />
      {group.label}
      {group.plugin?.version ? (
        <span className="font-mono text-caption font-normal text-ink-faint">
          {group.plugin.version}
        </span>
      ) : null}
      <span className="font-medium text-ink-faint tabular-nums">
        {group.records.length}
      </span>
      {hint ? (
        <span className="font-mono text-caption font-normal text-ink-faint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function InventoryView(props: InventoryViewProps) {
  const filtered = props.records.filter(
    (record) => props.kind === "all" || record.kind === props.kind
  );
  const groups = groupRecords(filtered);
  return (
    <div className="px-5 pt-3 pb-10">
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap gap-1.5 bg-canvas px-1 pt-1 pb-2">
        <Facet
          active={props.kind === "all"}
          onClick={() => props.onKind("all")}
        >
          All{" "}
          <span className="text-ink-faint tabular-nums">
            {props.records.length}
          </span>
        </Facet>
        {kindCounts(props.records).map(([kind, count]) => (
          <Facet
            key={kind}
            active={props.kind === kind}
            onClick={() => props.onKind(kind)}
          >
            <KindIcon kind={kind} small />
            {kindLabel[kind]}{" "}
            <span className="text-ink-faint tabular-nums">{count}</span>
          </Facet>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="py-16 text-center text-ink-faint">
          Nothing matches these filters. Turn on Show inactive or choose another
          kind.
        </p>
      ) : null}
      {groups.map((group) => (
        <section className="mb-3.5" key={group.key}>
          <GroupHead group={group} hint={props.hintFor(group)} />
          <div className="overflow-hidden rounded-card border border-hairline bg-surface">
            {group.records.map((record) => (
              <InventoryRow
                context={props.context}
                key={record.id}
                onSelect={props.onSelect}
                record={record}
                selected={record.id === props.selectedId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
