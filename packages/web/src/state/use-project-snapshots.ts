import { useEffect, useMemo, useState } from "react";
import { getInventory } from "../api";
import { buildRecords } from "../model/build-records";
import type { ReachProject } from "../views/reach/reach-model";

const projectName = (path: string) => path.split("/").at(-1) ?? path;
const pending = (list: readonly string[]) =>
  list.map((path) => ({ path, name: projectName(path) }));

/**
 * Scans every discovered project in parallel for the Global reach view.
 * Each project fills in as its scan finishes; a failed scan keeps its error instead of blocking the others.
 */
export function useProjectSnapshots(
  paths: readonly string[],
  refresh: number
): ReachProject[] {
  const pathsKey = paths.join("\n");
  const list = useMemo(() => pathsKey.split("\n").filter(Boolean), [pathsKey]);
  const key = `${refresh}\n${pathsKey}`;
  const [state, setState] = useState<{ key: string; projects: ReachProject[] }>(
    {
      key: "",
      projects: []
    }
  );
  useEffect(() => {
    const controller = new AbortController();
    const stateKey = `${refresh}\n${list.join("\n")}`;
    function update(path: string, result: Partial<ReachProject>) {
      setState((previous) => {
        const base =
          previous.key === stateKey ? previous.projects : pending(list);
        return {
          key: stateKey,
          projects: base.map((project) =>
            project.path === path ? { ...project, ...result } : project
          )
        };
      });
    }
    for (const path of list) {
      getInventory(path, controller.signal).then(
        (snapshot) => update(path, { records: buildRecords(snapshot) }),
        (error: unknown) => {
          if (!controller.signal.aborted) {
            update(path, {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      );
    }
    return () => controller.abort();
  }, [list, refresh]);
  return state.key === key ? state.projects : pending(list);
}
