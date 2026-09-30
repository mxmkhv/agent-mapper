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

/** Selection, inspector mode, and the search palette move together. */
function useSelection(
  records: InventoryRecord[],
  { tool, onTool, landing }: Pick<WorkspaceInput, "tool" | "onTool" | "landing">
) {
  const [selectedId, setSelectedId] = useState(landing?.selectId);
  const [showInactive, setShowInactive] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchShortcut(setSearchOpen);
  const selected = records.find((record) => record.id === selectedId);

  /**
   * Selecting from a link, search, or finding may cross tools or reveal a folded item.
   * Views that already show the row (Reach) pass `reveal: false` so the list does not reflow.
   */
  function select(id: string, { reveal = true }: { reveal?: boolean } = {}) {
    const record = records.find((item) => item.id === id);
    if (record && record.tool !== "unknown" && record.tool !== tool) {
      onTool(record.tool);
    }
    // Plugin versions fold against the other versions of the same tool.
    const sameTool = records.filter((item) => item.tool === record?.tool);
    if (reveal && record && foldInactive(sameTool).hidden(record)) {
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
  const [view, setView] = useState<View>(
    landing?.view ?? (isProject ? "map" : "reach")
  );
  const [kind, setKind] = useState<RecordKind | "all">(landing?.kind ?? "all");
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
  const selection = useSelection(lookup, input);
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
