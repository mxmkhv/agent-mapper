import type { WorktreeDifference } from "@agent-mapper/core";

export interface DifferenceGroup {
  key: string;
  /** Folder shown for the group, e.g. `.agents/skills/app-store-preflight-skills`. */
  label: string;
  rows: WorktreeDifference[];
  /** The shared state when every file agrees, otherwise "mixed". */
  state: WorktreeDifference["state"] | "mixed";
}

/** Skills, agents and commands are folders of files; one skill is one item, however many files it holds. */
const folderItems = /^(.*?\/(?:skills|agents|commands)\/[^/]+)\//;

export function groupDifferences(
  rows: readonly WorktreeDifference[]
): DifferenceGroup[] {
  const groups = new Map<string, WorktreeDifference[]>();
  for (const row of rows) {
    const key = folderItems.exec(row.relativePath)?.[1] ?? row.relativePath;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([key, members]) => {
    const states = new Set(members.map((row) => row.state));
    const [only] = states;
    return {
      key,
      label: key,
      rows: members,
      state: states.size === 1 && only ? only : "mixed"
    };
  });
}
