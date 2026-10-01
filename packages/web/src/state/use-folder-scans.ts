import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { InventorySnapshot } from "@agent-mapper/core";
import { getInventory } from "../api";

export type FolderScan<T> =
  { status: "ready"; value: T } | { status: "error"; message: string };

/** A folder's latest result, marked `refreshing` while a newer scan for it is still running. */
export type FolderResult<T> = FolderScan<T> & { refreshing: boolean };

const failed = (error: unknown): FolderScan<never> => ({
  status: "error",
  message: error instanceof Error ? error.message : String(error)
});

/**
 * Scans several folders in parallel and keeps only what `read` takes from each snapshot. Results fill in as
 * each scan finishes; a missing entry has never been scanned, and a failed scan keeps its error without blocking
 * the others. A new path list or refresh aborts the previous round, and late answers from it are dropped.
 * A folder keeps its last result until the new round answers for it, so a rescan updates rows in place
 * instead of blanking them; until then the result is marked `refreshing` so it is not presented as current.
 */
export function useFolderScans<T>(
  { paths, refresh }: { paths: readonly string[]; refresh: number },
  read: (snapshot: InventorySnapshot) => FolderScan<T>
): ReadonlyMap<string, FolderResult<T>> {
  const pathsKey = paths.join("\n");
  const list = useMemo(() => pathsKey.split("\n").filter(Boolean), [pathsKey]);
  // Each path list and refresh is one round; a result from an earlier round is still refreshing.
  const round = `${refresh}\n${pathsKey}`;
  const [scans, setScans] = useState<
    ReadonlyMap<string, { scan: FolderScan<T>; round: string }>
  >(new Map());
  const readSnapshot = useEffectEvent(read);
  useEffect(() => {
    const controller = new AbortController();
    function update(path: string, scan: FolderScan<T>) {
      if (!controller.signal.aborted) {
        setScans((previous) => new Map(previous).set(path, { scan, round }));
      }
    }
    for (const path of list) {
      // A reader that throws counts as a failed scan instead of leaving the folder refreshing forever.
      getInventory(path, controller.signal)
        .then((snapshot) => readSnapshot(snapshot))
        .then(
          (scan) => update(path, scan),
          (error: unknown) => update(path, failed(error))
        );
    }
    return () => controller.abort();
  }, [list, round]);
  // Only the folders asked for now; results for folders that left the list are not shown.
  return useMemo(
    () =>
      new Map(
        [...scans]
          .filter(([path]) => list.includes(path))
          .map(([path, result]) => [
            path,
            { ...result.scan, refreshing: result.round !== round }
          ])
      ),
    [scans, list, round]
  );
}
