import { useState } from "react";
import { setProjectHidden, type ProjectList } from "../api";

/**
 * Applies removals and restores the moment they are saved, instead of after the next home rediscovery, which
 * can take seconds. `refetch` then brings the server's list, which agrees with these overrides.
 */
export function useHiddenProjects(
  list: ProjectList | undefined,
  refetch: () => void
) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(
    new Map()
  );
  const hidden = new Set(list?.hidden);
  for (const [path, isHidden] of overrides) {
    if (isHidden) {
      hidden.add(path);
    } else {
      hidden.delete(path);
    }
  }
  async function setHidden(path: string, isHidden: boolean) {
    await setProjectHidden(path, isHidden);
    setOverrides((previous) => new Map(previous).set(path, isHidden));
    refetch();
  }
  return {
    projects: (list?.projects ?? []).filter(
      (project) => !hidden.has(project.path)
    ),
    hidden: [...hidden].sort(),
    setHidden
  };
}
