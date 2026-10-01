import { useMemo, useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { buildRecords } from "../model/build-records";
import { pathContext } from "../model/paths";
import { foldInactive } from "../model/plugin-versions";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import type { Landing, View } from "../shell/view-bar";
import { useSearchShortcut } from "../use-search-shortcut";
import { useDocumentView } from "./use-document-view";

interface WorkspaceInput {
  snapshot: InventorySnapshot;
  isProject: boolean;
  tool: ToolId;
  /** Records from other folders (Global reach), so links and rows from them can be inspected. */
  extraRecords: InventoryRecord[];
  landing?: Landing;
  onTool(tool: ToolId): void;
}

const belongsTo = (record: InventoryRecord, tool: ToolId) =>
  record.tool === tool || record.tool === "unknown";

/** Records for the selected tool; inactive ones and background plugin versions only when asked for. */
function forTool(
  records: InventoryRecord[],
  filter: { tool: ToolId; showInactive: boolean }
) {
  const toolRecords = records.filter((record) =>
    belongsTo(record, filter.tool)
  );
  const { hidden, otherVersions } = foldInactive(toolRecords);
  const shown = toolRecords.filter((record) => !hidden(record));
  return {
    toolRecords,
    visible: filter.showInactive ? toolRecords : shown,
    inactiveCount: toolRecords.length - shown.length,
    otherVersions
  };
}

/**
 * Whether the list for the record's tool hides it until Show inactive. Uses the same records and fold as
 * `forTool`; a record from another folder (Global reach) is hidden only when inactive.
 */
function foldedIn(records: readonly InventoryRecord[], tool: ToolId) {
  return (record: InventoryRecord) => {
    const own = records.filter((item) =>
      belongsTo(item, record.tool === "unknown" ? tool : record.tool)
    );
    return own.some((item) => item.id === record.id)
      ? foldInactive(own).hidden(record)
      : record.tier === "inactive";
  };
}

interface SelectOptions {
  /** Views that already show the row (Reach) pass false so the list does not reflow. */
  reveal?: boolean;
  /** An item the next scan adds (a moved skill) is not listed yet, so it names its tool. */
  tool?: ToolId;
}

const toolFor = (record: InventoryRecord | undefined, hint?: ToolId) =>
  record && record.tool !== "unknown" ? record.tool : hint;

/** Selection, inspector mode, and the search palette move together. */
function useSelection(
  records: InventoryRecord[],
  {
    tool,
    onTool,
    landing,
    isFolded
  }: Pick<WorkspaceInput, "tool" | "onTool" | "landing"> & {
    isFolded(record: InventoryRecord): boolean;
  }
) {
  const [selectedId, setSelectedId] = useState(
    landing && "selectId" in landing ? landing.selectId : undefined
  );
  const [showInactive, setShowInactive] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(setSearchOpen);
  const selected = records.find((record) => record.id === selectedId);

  /** Selecting from a link, search, or finding may cross tools or reveal a folded item. */
  function select(id: string, options: SelectOptions = {}) {
    const record = records.find((item) => item.id === id);
    const target = toolFor(record, options.tool);
    if (target && target !== tool) {
      onTool(target);
    }
    if ((options.reveal ?? true) && record && isFolded(record)) {
      setShowInactive(true);
    }
    setSelectedId(id);
    setShowCoverage(false);
    setSearchOpen(false);
  }

  return {
    selected: selected && belongsTo(selected, tool) ? selected : undefined,
    select,
    showInactive,
    toggleInactive: () => setShowInactive((value) => !value),
    showCoverage,
    toggleCoverage: () => setShowCoverage((value) => !value),
    closeInspector() {
      setSelectedId(undefined);
      setShowCoverage(false);
    },
    searchOpen,
    setSearchOpen
  };
}

/** The browsing view and kind filter; a landing from another folder can preset both. */
function useViewFilter(isProject: boolean, landing?: Landing) {
  const target = landing && "view" in landing ? landing : undefined;
  const [view, setView] = useState<View>(
    target?.view ?? (isProject ? "map" : "reach")
  );
  const [kind, setKind] = useState<RecordKind | "all">(target?.kind ?? "all");
  return { view, setView, kind, setKind };
}

/** All per-folder UI state: view, filters, selection, and the records the views render. */
export function useWorkspace(input: WorkspaceInput) {
  const { snapshot, isProject, tool } = input;
  const filter = useViewFilter(isProject, input.landing);
  const records = useMemo(
    () => buildRecords(snapshot, isProject ? "project" : "global"),
    [snapshot, isProject]
  );
  const context = useMemo(
    () => pathContext(snapshot, isProject),
    [snapshot, isProject]
  );
  const lookup = useMemo(
    () => [...records, ...input.extraRecords],
    [records, input.extraRecords]
  );
  const selection = useSelection(lookup, {
    ...input,
    isFolded: foldedIn(records, tool)
  });
  const documents = useDocumentView();
  return {
    ...selection,
    ...documents,
    /** Picking a record (for example from search) shows it, leaving any open document; its draft stays. */
    select(...args: Parameters<typeof selection.select>) {
      if (documents.documentView) {
        documents.closeDocument();
      }
      selection.select(...args);
    },
    view: filter.view,
    /** Choosing a view leaves any open document; its draft stays in the Drafts menu. */
    setView(next: View) {
      if (documents.documentView) {
        documents.closeDocument();
      }
      filter.setView(next);
    },
    kind: filter.kind,
    filterKind(next: RecordKind | "all") {
      filter.setKind(next);
      filter.setView("inventory");
    },
    records,
    lookup,
    ...forTool(records, { tool, showInactive: selection.showInactive }),
    findings: snapshot.findings.filter((finding) => finding.tool === tool),
    context
  };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
