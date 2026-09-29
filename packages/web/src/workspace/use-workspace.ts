import { useMemo, useState } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { buildRecords } from "../model/build-records";
import { pathContext } from "../model/paths";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import type { View } from "../shell/view-bar";
import { useSearchShortcut } from "../use-search-shortcut";
import { useDocumentView } from "./use-document-view";

interface WorkspaceInput {
  snapshot: InventorySnapshot;
  isProject: boolean;
  tool: ToolId;
  /** Records from other folders (Global reach), so links and rows from them can be inspected. */
  extraRecords: InventoryRecord[];
  initialSelectedId?: string;
  onTool(tool: ToolId): void;
}

const belongsTo = (record: InventoryRecord, tool: ToolId) =>
  record.tool === tool || record.tool === "unknown";

/** Records for the selected tool; inactive ones only when the user asked to see them. */
function forTool(
  records: InventoryRecord[],
  filter: { tool: ToolId; showInactive: boolean }
) {
  const toolRecords = records.filter((record) =>
    belongsTo(record, filter.tool)
  );
  const active = toolRecords.filter((record) => record.tier !== "inactive");
  return {
    toolRecords,
    visible: filter.showInactive ? toolRecords : active,
    inactiveCount: toolRecords.length - active.length
  };
}

/** Selection, inspector mode, and the search palette move together. */
function useSelection(
  records: InventoryRecord[],
  {
    tool,
    onTool,
    initialSelectedId
  }: Pick<WorkspaceInput, "tool" | "onTool" | "initialSelectedId">
) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [showInactive, setShowInactive] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(setSearchOpen);
  const selected = records.find((record) => record.id === selectedId);

  /**
   * Selecting from a link, search, or finding may cross tools or reveal an inactive item.
   * Views that already show the row (Reach) pass `reveal: false` so the list does not reflow.
   */
  function select(id: string, { reveal = true }: { reveal?: boolean } = {}) {
    const record = records.find((item) => item.id === id);
    if (record && record.tool !== "unknown" && record.tool !== tool) {
      onTool(record.tool);
    }
    if (reveal && record?.tier === "inactive") {
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

/** All per-folder UI state: view, filters, selection, and the records the views render. */
export function useWorkspace(input: WorkspaceInput) {
  const { snapshot, isProject, tool } = input;
  const [view, setView] = useState<View>(isProject ? "map" : "reach");
  const [kind, setKind] = useState<RecordKind | "all">("all");
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
  const selection = useSelection(lookup, input);
  const documents = useDocumentView();
  return {
    ...selection,
    ...documents,
    view,
    /** Choosing a view leaves any open document; its draft stays in the Drafts menu. */
    setView(next: View) {
      if (documents.documentView) {
        documents.closeDocument();
      }
      setView(next);
    },
    kind,
    filterKind(next: RecordKind | "all") {
      setKind(next);
      setView("inventory");
    },
    records,
    lookup,
    ...forTool(records, { tool, showInactive: selection.showInactive }),
    findings: snapshot.findings.filter((finding) => finding.tool === tool),
    context
  };
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;
