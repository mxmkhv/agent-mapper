import type { Finding, ResolvedEntry } from "@agent-mapper/core";
import { finding, source } from "./finding-builder";

/**
 * Separate skill files that declare the same name. Listings show only the name, so the copies look the same;
 * links to one file count once. Plugin skills are namespaced by their plugin and are left out.
 */
export function duplicateSkillFindings(items: ResolvedEntry[]): Finding[] {
  const groups = new Map<string, ResolvedEntry[]>();
  for (const item of items) {
    const { entry, resolution } = item;
    if (
      entry.kind === "skill" &&
      !entry.pluginId &&
      resolution.availability === "expected"
    ) {
      const key = `${entry.tool}\0${entry.name}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
  }
  return [...groups.values()].flatMap((group) => {
    const files = new Set(
      group.map(({ entry }) => entry.realPath ?? entry.path)
    );
    const [first] = group;
    if (!first || files.size < 2) {
      return [];
    }
    return [
      finding({
        tool: first.entry.tool,
        code: "duplicate-skill-name",
        level: "review",
        title: "Skills share a name",
        reason: `${files.size} skill files are named ${first.entry.name}. Rename or remove the copies you do not need.`,
        sources: group.map(source),
        identity: first.entry.name
      })
    ];
  });
}
