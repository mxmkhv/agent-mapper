import type { InventoryRecord, Tier } from "./record-types";

const tierByState = new Map<string, Tier>([
  ["expected", "active"],
  ["configured", "active"],
  ["conditional", "active"],
  ["selected", "active"],
  ["startup index", "active"],
  ["on demand", "active"],
  ["shadowed", "inactive"],
  ["not-applicable", "inactive"],
  ["disabled", "inactive"],
  ["cached", "inactive"],
  ["approval required", "approval"],
  ["missing", "problem"]
]);

export function tierOf(state: string, readState?: string): Tier {
  if (readState === "missing" || readState === "unreadable") {
    return "problem";
  }
  return tierByState.get(state) ?? "unknown";
}

const activeText = new Map([
  ["startup", "Loads at startup"],
  ["startup index", "Loads at startup"],
  ["agent-selected", "Available on demand"],
  ["on demand", "Available on demand"],
  ["conditional", "Loads conditionally"]
]);

const inactiveText = new Map([
  ["shadowed", "Not used here"],
  ["not-applicable", "Not used here"],
  ["disabled", "Disabled"],
  ["cached", "Cached version"],
  ["cached version", "Cached version"]
]);

const inactiveLabel = new Map([
  ["shadowed", "not used"],
  ["not-applicable", "not used"],
  ["disabled", "disabled"],
  ["cached", "cached version"],
  ["cached version", "cached version"]
]);

const attentionText = {
  approval: "Needs approval",
  unknown: "Unknown",
  problem: "Problem"
} satisfies Record<Exclude<Tier, "active" | "inactive">, string>;

/** Sentence-case state for the inspector and tooltips. */
export function stateText(record: InventoryRecord): string {
  if (record.tier === "active") {
    if (record.kind === "plugin") {
      return "Selected version";
    }
    return activeText.get(record.loading ?? "") ?? "Configured";
  }
  if (record.tier === "inactive") {
    return inactiveText.get(record.label) ?? record.label;
  }
  return attentionText[record.tier];
}

/** Short lowercase label shown in rows. Active records have none: normal is quiet. */
export function stateLabel(record: InventoryRecord): string | undefined {
  if (record.tier === "active") {
    return undefined;
  }
  if (record.tier === "inactive") {
    return inactiveLabel.get(record.label) ?? record.label;
  }
  return attentionText[record.tier].toLocaleLowerCase();
}
