import type {
  SkillTransferApply,
  SkillTransferPlan,
  SkillTransferRequest,
  SkillTransferResult
} from "@agent-mapper/core";
import { isRecord, postJson } from "./source-document-api";

function isPlan(value: unknown): value is SkillTransferPlan {
  return (
    isRecord(value) &&
    typeof value.fingerprint === "string" &&
    Array.isArray(value.files) &&
    Array.isArray(value.destinations) &&
    Array.isArray(value.warnings)
  );
}

function isResult(value: unknown): value is SkillTransferResult {
  return (
    isRecord(value) &&
    Array.isArray(value.created) &&
    Array.isArray(value.warnings)
  );
}

/** What copying or moving would write, and whether anything is in the way. Writes nothing. */
export function planSkillTransfer(
  request: SkillTransferRequest,
  signal?: AbortSignal
): Promise<SkillTransferPlan> {
  return postJson("/api/skill-transfer/plan", {
    body: request,
    signal,
    valid: isPlan
  });
}

export function applySkillTransfer(
  request: SkillTransferApply
): Promise<SkillTransferResult> {
  return postJson("/api/skill-transfer/apply", {
    body: request,
    valid: isResult
  });
}
