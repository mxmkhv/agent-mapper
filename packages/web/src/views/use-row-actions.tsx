import { useState } from "react";
import type { ToolId } from "@agent-mapper/core";
import type { DocumentMode } from "../documents/source-document-panel";
import { DeleteDialog } from "../inspector/delete-dialog";
import { SkillTransferDialog } from "../inspector/skill-transfer";
import type { CopyTarget } from "../model/copy-targets";
import type { PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { useEditRecord } from "../state/use-edit-record";
import type { RowActionHandlers } from "./inventory-row";

export interface RowActionScope {
  context: PathContext;
  /** What a row's Copy needs: the scanned folder, its scan time, and where a skill can go. */
  transfer: {
    workingDirectory: string;
    scannedAt: string;
    copyTargets: readonly CopyTarget[];
  };
  onSelect(id: string, options?: { tool?: ToolId }): void;
  onOpenDocument(sourceKey: string, mode: DocumentMode): void;
}

/** Edit, Copy and Delete for the Inventory's rows: the handlers, plus the failure line and dialog the view places once. */
export function useRowActions(scope: RowActionScope) {
  const [copying, setCopying] = useState<InventoryRecord>();
  const [deleting, setDeleting] = useState<InventoryRecord>();
  const editing = useEditRecord(scope.onOpenDocument);
  const handlers: RowActionHandlers = {
    onEdit: (record) => void editing.edit(record),
    onCopy: setCopying,
    onDelete: setDeleting
  };
  return {
    handlers,
    error: editing.error ? (
      <p className="mt-0 mb-3 text-label text-problem" role="alert">
        {editing.error}
      </p>
    ) : null,
    dialog: copying?.sourceRef ? (
      <SkillTransferDialog
        context={scope.context}
        copyTargets={scope.transfer.copyTargets}
        onClose={() => setCopying(undefined)}
        onSelect={scope.onSelect}
        record={copying}
        scannedAt={scope.transfer.scannedAt}
        sourceRef={copying.sourceRef}
      />
    ) : null,
    deleteDialog: deleting?.sourceRef ? (
      <DeleteDialog
        context={scope.context}
        onClose={() => setDeleting(undefined)}
        record={deleting}
        sourceRef={deleting.sourceRef}
      />
    ) : null
  };
}
