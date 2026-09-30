import { useEffect, useState } from "react";
import type {
  SkillTransferPlan,
  SkillTransferRequest,
  SkillTransferResult
} from "@agent-mapper/core";
import { applySkillTransfer, planSkillTransfer } from "../skill-transfer-api";

export type PlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; plan: SkillTransferPlan }
  | { status: "error"; message: string };

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Previews the chosen transfer and checks it again after every rescan. A slow preview for an
 * earlier choice is aborted, never shown.
 */
export function useTransferPlan(
  request: SkillTransferRequest | undefined,
  scannedAt: string
) {
  const [state, setState] = useState<{
    request?: SkillTransferRequest;
    value: PlanState;
  }>({ value: { status: "idle" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!request) {
      return;
    }
    const controller = new AbortController();
    planSkillTransfer(request, controller.signal).then(
      (plan) => setState({ request, value: { status: "ready", plan } }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            request,
            value: { status: "error", message: messageOf(error) }
          });
        }
      }
    );
    return () => controller.abort();
  }, [request, scannedAt, attempt]);
  let value: PlanState = { status: "idle" };
  if (request) {
    value = state.request === request ? state.value : { status: "loading" };
  }
  return { state: value, recheck: () => setAttempt((count) => count + 1) };
}

/** Runs the reviewed transfer once; a failure keeps its message and asks for a fresh preview. */
export function useTransferApply(input: {
  request: SkillTransferRequest | undefined;
  recheck(): void;
  onDone(result: SkillTransferResult): void;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>();
  async function apply(plan: SkillTransferPlan) {
    if (!input.request || applying) {
      return;
    }
    setApplying(true);
    setError(undefined);
    let result: SkillTransferResult;
    try {
      result = await applySkillTransfer({
        ...input.request,
        fingerprint: plan.fingerprint
      });
    } catch (cause) {
      setError(messageOf(cause));
      input.recheck();
      return;
    } finally {
      setApplying(false);
    }
    // Outside the try: the files are written, so a UI failure here is not a failed transfer.
    input.onDone(result);
  }
  return { apply, applying, error };
}
