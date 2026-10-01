import type {
  SourceDeleteApply,
  SourceDeletePlan,
  SourceDeleteResult,
  SourceRef
} from "@agent-mapper/core";
import { isRecord, postJson } from "./source-document-api";

function isPlan(value: unknown): value is SourceDeletePlan {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.fingerprint === "string" &&
    Array.isArray(value.warnings)
  );
}

function isResult(value: unknown): value is SourceDeleteResult {
  return isRecord(value) && typeof value.trashed === "string";
}

/** What deleting would move to the Trash, and whether it may. Writes nothing. */
export function planDelete(
  source: SourceRef,
  signal?: AbortSignal
): Promise<SourceDeletePlan> {
  return postJson("/api/source-delete/plan", {
    body: { source },
    signal,
    valid: isPlan
  });
}

export function applyDelete(
  request: SourceDeleteApply
): Promise<SourceDeleteResult> {
  return postJson("/api/source-delete/apply", {
    body: request,
    valid: isResult
  });
}
