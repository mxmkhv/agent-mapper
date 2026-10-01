import { Fragment, useState, type ReactNode } from "react";
import type { ToolId } from "@agent-mapper/core";
import type { PathContext } from "../model/paths";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { repeatedNames } from "../model/same-names";
import { KindIcon, kindLabel } from "../ui/kind-icon";
import {
  GroupHead,
  InheritedToggle,
  SourceToggle
} from "./inventory-group-head";
import {
  groupRecords,
  isLocalGroup,
  kindCounts,
  clusterBySource,
  type InventoryGroup
} from "./inventory-groups";
import { InventoryRow } from "./inventory-row";

interface InventoryViewProps {
  records: InventoryRecord[];
  kind: RecordKind | "all";
  tool: ToolId;
  /** A project splits into its own groups and a collapsible section for everything it inherits. */
  isProject: boolean;
  selectedId?: string;
  /** Changes on every selection that should be shown, including picking the selected item again. */
  revealRequest: number;
  context: PathContext;
  /** Background versions per plugin name, while they are folded into the active version's row. */
  otherVersions?: ReadonlyMap<string, number>;
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

const localBorder = {
  claude: "border-claude/50",
  codex: "border-codex/50"
} satisfies Record<ToolId, string>;

export function InventoryView(props: InventoryViewProps) {
  const [inheritedChoice, setInheritedChoice] = useState<boolean>();
  // Source clusters the user folded away, keyed by group and repo.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleSource = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  const filtered = props.records.filter(
    (record) => props.kind === "all" || record.kind === props.kind
  );
  const groups = groupRecords(filtered);
  const isInherited = (group: InventoryGroup) =>
    props.isProject && !isLocalGroup(group);
  const inherited = groups.filter(isInherited);
  const listed = groups.filter((group) => !isInherited(group));
  const selectedGroup = groups.find((group) =>
    group.records.some((record) => record.id === props.selectedId)
  );
  // A selection made elsewhere (search, the inspector) unfolds whatever hides its row.
  const [revealed, setRevealed] = useState(props.revealRequest);
  if (props.revealRequest !== revealed) {
    setRevealed(props.revealRequest);
    const repo = selectedGroup?.records.find(
      (record) => record.id === props.selectedId
    )?.installedFrom?.repo;
    const key = `${selectedGroup?.key}:${repo}`;
    if (selectedGroup && isInherited(selectedGroup)) {
      setInheritedChoice(true);
    }
    if (collapsed.has(key)) {
      toggleSource(key);
    }
  }
  // Collapsed by default, unless that would hide the selection or leave the pane empty.
  const inheritedOpen =
    inheritedChoice ??
    (listed.length === 0 ||
      Boolean(selectedGroup && isInherited(selectedGroup)));
  const renderGroup = (group: InventoryGroup) => {
    const repeated = repeatedNames(group.records);
    const isOwn = props.isProject && isLocalGroup(group);
    return (
      <section className="mb-3.5" key={group.key}>
        <GroupHead
          group={group}
          hint={props.hintFor(group)}
          localTool={isOwn ? props.tool : undefined}
        />
        <div
          className={`overflow-hidden rounded-card border bg-surface ${isOwn ? localBorder[props.tool] : "border-hairline"}`}
        >
          {clusterBySource(group.records).map(({ source, records }) => {
            const key = `${group.key}:${source?.repo}`;
            const open = !source || !collapsed.has(key);
            return (
              <Fragment key={source?.repo ?? records[0]?.id}>
                {source ? (
                  <SourceToggle
                    onToggle={() => toggleSource(key)}
                    open={open}
                    source={source}
                  />
                ) : null}
                {open
                  ? records.map((record) => (
                      <InventoryRow
                        context={props.context}
                        key={record.id}
                        onSelect={props.onSelect}
                        otherVersions={
                          record.kind === "plugin"
                            ? props.otherVersions?.get(record.name)
                            : undefined
                        }
                        record={record}
                        selected={record.id === props.selectedId}
                        sharesName={repeated.has(record.name)}
                        tone={source?.tone}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })}
        </div>
      </section>
    );
  };
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
      {inherited.length ? (
        <InheritedToggle
          groups={inherited}
          onToggle={() => setInheritedChoice(!inheritedOpen)}
          open={inheritedOpen}
        />
      ) : null}
      {inheritedOpen ? inherited.map(renderGroup) : null}
      {listed.map(renderGroup)}
    </div>
  );
}
