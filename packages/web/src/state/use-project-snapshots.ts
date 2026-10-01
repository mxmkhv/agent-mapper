import { useMemo } from "react";
import { buildRecords } from "../model/build-records";
import type { ReachProject } from "../views/reach/reach-model";
import { useFolderScans } from "./use-folder-scans";

const projectName = (path: string) => path.split("/").at(-1) ?? path;

/**
 * Scans every discovered project in parallel for the Global reach view.
 * Each project fills in as its scan finishes; a failed scan keeps its error instead of blocking the others.
 * On a rescan each project keeps its last result, marked refreshing, until its new scan answers.
 */
export function useProjectSnapshots(
  paths: readonly string[],
  refresh: number
): ReachProject[] {
  const scans = useFolderScans({ paths, refresh }, (snapshot) => ({
    status: "ready",
    value: buildRecords(snapshot, "project")
  }));
  // Callers pass a fresh array each render; the joined paths are the stable identity.
  const pathsKey = paths.join("\n");
  return useMemo(
    () =>
      pathsKey
        .split("\n")
        .filter(Boolean)
        .map((path) => {
          const scan = scans.get(path);
          return {
            path,
            name: projectName(path),
            records: scan?.status === "ready" ? scan.value : undefined,
            error: scan?.status === "error" ? scan.message : undefined,
            refreshing: scan?.refreshing ?? false
          };
        }),
    [pathsKey, scans]
  );
}
