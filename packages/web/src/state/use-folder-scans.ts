import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { InventorySnapshot } from "@agent-mapper/core";
import { getInventory } from "../api";

export type FolderScan<T> =
  { status: "ready"; value: T } | { status: "error"; message: string };

const failed = (error: unknown): FolderScan<never> => ({
  status: "error",
  message: error instanceof Error ? error.message : String(error)
});

/**
 * Scans several folders in parallel and keeps only what `read` takes from each snapshot. Results fill in as
 * each scan finishes; a missing entry is still scanning, and a failed scan keeps its error without blocking
 * the others. A new path list or refresh aborts the previous round, and late answers from it are dropped.
 */
export function useFolderScans<T>(
  { paths, refresh }: { paths: readonly string[]; refresh: number },
  read: (snapshot: InventorySnapshot) => FolderScan<T>
): ReadonlyMap<string, FolderScan<T>> {
  const pathsKey = paths.join("\n");
  const list = useMemo(() => pathsKey.split("\n").filter(Boolean), [pathsKey]);
  const key = `${refresh}\n${pathsKey}`;
  const [state, setState] = useState<{
    key: string;
    scans: ReadonlyMap<string, FolderScan<T>>;
  }>({ key: "", scans: new Map() });
  const readSnapshot = useEffectEvent(read);
  useEffect(() => {
    const controller = new AbortController();
    const stateKey = `${refresh}\n${list.join("\n")}`;
    function update(path: string, scan: FolderScan<T>) {
      if (controller.signal.aborted) {
        return;
      }
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
        (snapshot) => update(path, readSnapshot(snapshot)),
        (error: unknown) => update(path, failed(error))
      );
    }
    return () => controller.abort();
  }, [list, refresh]);
  return useMemo(
    () => (state.key === key ? state.scans : new Map()),
    [state, key]
  );
}
