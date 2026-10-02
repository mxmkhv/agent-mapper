import { Fragment, useState, type ReactNode } from "react";
import type { ToolId } from "@agent-mapper/core";
import type { GroupFocus } from "../workspace/use-workspace";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { repeatedNames } from "../model/same-names";
import { KindIcon, kindLabel } from "../ui/kind-icon";
import {
  GroupHead,
  InheritedSection,
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
import { groupElementId, useGroupFocus } from "./use-group-focus";
import { useRowActions, type RowActionScope } from "./use-row-actions";

interface InventoryViewProps extends RowActionScope {
  records: InventoryRecord[];
  kind: RecordKind | "all";
  tool: ToolId;
  /** A project splits into its own groups and a collapsible section for everything it inherits. */
  isProject: boolean;
  selectedId?: string;
  /** Changes on every selection that should be shown, including picking the selected item again. */
  revealRequest: number;
  /** Shown above the list: what a fresh session in the project starts with. */
  summary?: ReactNode;
  /** Row labels for records that win an override or share a name, by record id. */
  relations: ReadonlyMap<string, string>;
  /** Background versions per plugin name, while they are folded into the active version's row. */
  otherVersions?: ReadonlyMap<string, number>;
  hintFor(group: InventoryGroup): string | undefined;
  /** A group to scroll to, such as a plugin's after its contributions were picked in the inspector. */
  groupFocus?: GroupFocus;
  onGroupFocused(): void;
  onKind(kind: RecordKind | "all"): void;
}

/** Faint beside an idle facet; the selected facet's count takes its inverted colour. */
const facetCount = "font-mono text-mono opacity-70";

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
      className={`-mr-px inline-flex h-7 items-center gap-[7px] border border-b-0 px-[11px] text-label ${active ? "border-ink bg-ink font-semibold text-canvas" : "border-rule font-medium hover:bg-wash"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

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
  const rowActions = useRowActions(props);
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
  useGroupFocus(props.groupFocus, {
    onReveal(key) {
      const group = groups.find((item) => item.key === key);
      if (group && isInherited(group)) {
        setInheritedChoice(true);
      }
    },
    onDone: props.onGroupFocused
  });
  // Collapsed by default, unless that would hide the selection or leave the pane empty.
  const inheritedOpen =
    inheritedChoice ??
    (listed.length === 0 ||
      Boolean(selectedGroup && isInherited(selectedGroup)));
  const renderGroup = (group: InventoryGroup) => {
    const repeated = repeatedNames(group.records);
    const isOwn = props.isProject && isLocalGroup(group);
    return (
      <section
        className="mb-3.5 scroll-mt-24 border-2 border-rule"
        id={groupElementId(group.key)}
        key={group.key}
      >
        <GroupHead
          group={group}
          hint={props.hintFor(group)}
          localTool={isOwn ? props.tool : undefined}
        />
        <div>
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
                        actions={rowActions.handlers}
                        context={props.context}
                        key={record.id}
                        onSelect={props.onSelect}
                        otherVersions={
                          record.kind === "plugin"
                            ? props.otherVersions?.get(record.name)
                            : undefined
                        }
                        record={record}
                        relation={props.relations.get(record.id)}
                        selected={record.id === props.selectedId}
                        sharesName={repeated.has(record.name)}
                        workingDirectory={props.transfer.workingDirectory}
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
      {props.summary ? <div className="pt-1">{props.summary}</div> : null}
      <div className="sticky top-0 z-10 mb-3.5 flex flex-wrap border-b-2 border-rule bg-canvas pt-2">
        <Facet
          active={props.kind === "all"}
          onClick={() => props.onKind("all")}
        >
          All <span className={facetCount}>{props.records.length}</span>
        </Facet>
        {kindCounts(props.records).map(([kind, count]) => (
          <Facet
            key={kind}
            active={props.kind === kind}
            onClick={() => props.onKind(kind)}
          >
            <KindIcon kind={kind} />
            {kindLabel[kind]} <span className={facetCount}>{count}</span>
          </Facet>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="py-16 text-center text-ink-faint">
          Nothing matches these filters. Turn on Show inactive or choose another
          kind.
        </p>
      ) : null}
      {rowActions.error}
      {inherited.length ? (
        <InheritedSection
          groups={inherited}
          onToggle={() => setInheritedChoice(!inheritedOpen)}
          open={inheritedOpen}
        >
          {inherited.map(renderGroup)}
        </InheritedSection>
      ) : null}
      {listed.map(renderGroup)}
      {rowActions.dialog}
      {rowActions.deleteDialog}
    </div>
  );
}
