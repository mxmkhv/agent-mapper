import type { InventoryEntry, ResolvedEntry } from "./inventory";

const charactersPerToken = 4;

export function expectedEntry(entry: InventoryEntry): ResolvedEntry {
  const skill = entry.kind === "skill";
  const estimate = Math.round((entry.characters ?? 0) / charactersPerToken);
  const bodyEstimate = Math.round(
    Math.max(0, (entry.characters ?? 0) - (entry.metadataCharacters ?? 0)) /
      charactersPerToken
  );
  return {
    entry,
    resolution: {
      availability: "expected",
      loading: skill ? "agent-selected" : "startup",
      reason: skill
        ? "Skill is discoverable for this folder; its body loads when selected."
        : "Instruction is in the selected folder's expected startup path.",
      estimatedTokens: {
        startup: skill ? 0 : estimate,
        onDemand: skill ? bodyEstimate : 0
      }
    }
  };
}
