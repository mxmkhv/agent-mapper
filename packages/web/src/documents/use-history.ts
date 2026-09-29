import { useEffect, useEffectEvent, useState } from "react";
import type { RevisionContent, RevisionHistory } from "@agent-mapper/core";
import { sourceHistory, sourceRevision } from "../source-document-api";

export type Load<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

interface Keyed<T> {
  key: string;
  load: Load<T>;
}

const failed = (error: unknown): Load<never> => ({
  status: "error",
  message: error instanceof Error ? error.message : String(error)
});

function visible<T>(
  stateKey: string | undefined,
  state: Keyed<T> | undefined
): Load<T> | undefined {
  if (stateKey === undefined) {
    return undefined;
  }
  return state?.key === stateKey ? state.load : { status: "loading" };
}

interface Loaded<T> {
  load?: Load<T>;
  retry(): void;
}

/** Loads one request per key; `retry` reruns it. A late answer for an older key is ignored. */
function useLoad<T>(
  key: string | undefined,
  request: () => Promise<T>
): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Keyed<T>>();
  const stateKey = key === undefined ? undefined : `${key}\0${attempt}`;
  const run = useEffectEvent(request);
  useEffect(() => {
    if (stateKey === undefined) {
      return;
    }
    let current = true;
    run().then(
      (value) =>
        current &&
        setState({ key: stateKey, load: { status: "ready", value } }),
      (error: unknown) =>
        current && setState({ key: stateKey, load: failed(error) })
    );
    return () => {
      current = false;
    };
  }, [stateKey]);
  return {
    load: visible(stateKey, state),
    retry: () => setAttempt((value) => value + 1)
  };
}

export function useHistoryList(documentId: string) {
  return useLoad<RevisionHistory>(documentId, () => sourceHistory(documentId));
}

export function useRevision(documentId: string, revisionId?: string) {
  return useLoad<RevisionContent>(
    revisionId === undefined ? undefined : `${documentId}\0${revisionId}`,
    () => sourceRevision({ documentId, revisionId: revisionId ?? "" })
  );
}
