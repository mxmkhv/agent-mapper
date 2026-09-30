import { useEffect, useMemo, useState } from "react";
import type { WorktreeDifference } from "@agent-mapper/core";
import { getInventory } from "../../api";

export type CheckoutScan =
  | { status: "ready"; differences: WorktreeDifference[] }
  | { status: "error"; message: string };

/**
 * Scans each linked checkout for its comparison with the main checkout, so the list can say which ones drifted.
 * Results fill in as each scan finishes; a missing entry is still scanning.
 */
export function useCheckoutDifferences(
  paths: readonly string[],
  refresh: number
): ReadonlyMap<string, CheckoutScan> {
  const pathsKey = paths.join("\n");
  const list = useMemo(() => pathsKey.split("\n").filter(Boolean), [pathsKey]);
  const key = `${refresh}\n${pathsKey}`;
  const [state, setState] = useState<{
    key: string;
    scans: ReadonlyMap<string, CheckoutScan>;
  }>({ key: "", scans: new Map() });
  useEffect(() => {
    const controller = new AbortController();
    const stateKey = `${refresh}\n${list.join("\n")}`;
    function update(path: string, scan: CheckoutScan) {
      setState((previous) => ({
        key: stateKey,
        scans: new Map(previous.key === stateKey ? previous.scans : []).set(
          path,
          scan
        )
      }));
    }
    for (const path of list) {
      getInventory(path, controller.signal).then(
        (snapshot) =>
          update(path, {
            status: "ready",
            differences: snapshot.comparison?.differences ?? []
          }),
        (error: unknown) => {
          if (!controller.signal.aborted) {
            update(path, {
              status: "error",
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );
    }
    return () => controller.abort();
  }, [list, refresh]);
  return state.key === key ? state.scans : new Map();
}
