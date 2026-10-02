import { useState } from "react";
import { sourceAction, type SourceAction } from "../api";

interface ActionError {
  id: string;
  message: string;
}

/** Open in editor / Reveal in the file manager for one record, keeping the error next to the record that failed. */
export function useSourceAction(workingDirectory: string) {
  const [error, setError] = useState<ActionError>();
  async function run(id: string, action: SourceAction) {
    setError(undefined);
    try {
      await sourceAction({ path: workingDirectory, id, action });
    } catch (cause) {
      setError({
        id,
        message: cause instanceof Error ? cause.message : String(cause)
      });
    }
  }
  return {
    run,
    errorFor: (id: string) => (error?.id === id ? error.message : undefined)
  };
}
