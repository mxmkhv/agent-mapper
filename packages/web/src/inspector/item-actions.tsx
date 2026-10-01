import type { SourceRef, ToolId } from "@agent-mapper/core";
import {
  SourceDocumentPanel,
  type DocumentMode
} from "../documents/source-document-panel";
import type { CopyTarget } from "../model/copy-targets";
import { canCopy, canDelete, canEdit } from "../model/copyable";
import type { PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { DeleteButton } from "./delete-dialog";
import { SkillTransfer } from "./skill-transfer";

interface ItemProps {
  record: InventoryRecord;
  sourceRef: SourceRef;
  scope: {
    context: PathContext;
    scannedAt: string;
    copyTargets: readonly CopyTarget[];
  };
  onSelect(id: string, options?: { tool?: ToolId }): void;
}

/** Copy and Delete for a skill or agent, placed after Edit in the inspector. */
function ItemActions({ record, sourceRef, scope, onSelect }: ItemProps) {
  return (
    <>
      {canCopy(record) ? (
        <SkillTransfer
          context={scope.context}
          copyTargets={scope.copyTargets}
          onSelect={onSelect}
          record={record}
          scannedAt={scope.scannedAt}
          sourceRef={sourceRef}
        />
      ) : null}
      {canDelete(record) ? (
        <DeleteButton
          context={scope.context}
          record={record}
          sourceRef={sourceRef}
        />
      ) : null}
    </>
  );
}

/**
 * The inspector's file block: a readable file previews with Edit, Copy and Delete. One that cannot be read (a
 * broken link) has nothing to show or edit, but can still be deleted.
 */
export function ItemFile(
  props: ItemProps & {
    onOpenDocument(sourceKey: string, mode: DocumentMode): void;
  }
) {
  const { record, sourceRef, scope, onOpenDocument } = props;
  if (!canEdit(record)) {
    return canDelete(record) ? (
      <div className="mt-5 flex flex-wrap gap-2">
        <ItemActions {...props} />
      </div>
    ) : null;
  }
  return (
    <div className="mt-5">
      <SourceDocumentPanel
        actions={<ItemActions {...props} />}
        onOpen={onOpenDocument}
        scannedAt={scope.scannedAt}
        sourceRef={sourceRef}
      />
    </div>
  );
}
