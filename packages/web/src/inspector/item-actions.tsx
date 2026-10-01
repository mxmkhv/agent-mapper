import type { SourceRef, ToolId } from "@agent-mapper/core";
import type { CopyTarget } from "../model/copy-targets";
import { canCopy, canDelete } from "../model/copyable";
import type { PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { DeleteButton } from "./delete-dialog";
import { SkillTransfer } from "./skill-transfer";

/** Copy and Delete for a skill or agent, placed after Edit in the inspector. */
export function ItemActions({
  record,
  sourceRef,
  scope,
  onSelect
}: {
  record: InventoryRecord;
  sourceRef: SourceRef;
  scope: {
    context: PathContext;
    scannedAt: string;
    copyTargets: readonly CopyTarget[];
  };
  onSelect(id: string, options?: { tool?: ToolId }): void;
}) {
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
