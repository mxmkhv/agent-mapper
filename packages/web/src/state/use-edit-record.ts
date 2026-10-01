import { useState } from "react";
import type { DocumentMode } from "../documents/source-document-panel";
import type { InventoryRecord } from "../model/record-types";
import { openSourceDocument } from "../source-document-api";
import { useDocuments } from "./use-document-drafts";

/** Opens a record's file in the editor straight from a list, where no inspector has loaded it yet. */
export function useEditRecord(
  onOpen: (sourceKey: string, mode: DocumentMode) => void
) {
  const { store } = useDocuments();
  const [error, setError] = useState<string>();
  async function edit(record: InventoryRecord) {
    const ref = record.sourceRef;
    if (!ref) {
      return;
    }
    setError(undefined);
    try {
      const document = await openSourceDocument(ref);
      store.load(document, ref);
      onOpen(document.sourceKey, "edit");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      setError(`Could not open ${record.name} for editing: ${reason}`);
    }
  }
  return { edit, error };
}
