import type { InventoryEntry, ResolvedEntry } from "./inventory";

const charactersPerToken = 4;

function reason(entry: InventoryEntry): string {
  if (entry.declarationOnly) {
    return "Command is declared by the selected plugin; its body size is not available.";
  }
  if (entry.kind === "command") {
    return "Command is available for this folder; its body loads when invoked.";
  }
  if (entry.kind === "skill") {
    return "Skill is discoverable for this folder; its body loads when selected.";
  }
  return "Instruction is in the selected folder's expected startup path.";
}

export function expectedEntry(entry: InventoryEntry): ResolvedEntry {
  const onDemand = entry.kind === "skill" || entry.kind === "command";
  const estimate = Math.round((entry.characters ?? 0) / charactersPerToken);
  const bodyEstimate = Math.round(
    Math.max(0, (entry.characters ?? 0) - (entry.metadataCharacters ?? 0)) /
      charactersPerToken
  );
  return {
    entry,
    resolution: {
      availability: "expected",
      loading: onDemand ? "agent-selected" : "startup",
      reason: reason(entry),
      estimatedTokens: entry.declarationOnly
        ? undefined
        : {
            startup: onDemand ? 0 : estimate,
            onDemand: onDemand ? bodyEstimate : 0
          }
    }
  };
}
