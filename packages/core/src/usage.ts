export interface UsageCoverage {
  sessions: number;
  from?: string;
  to?: string;
}

export interface UsageRecord {
  entryId: string;
  state: "recorded" | "none" | "uncovered";
  eventType: "invocation";
  count: number;
  lastRecorded?: string;
  coverage: UsageCoverage;
}

export interface UsageSummary {
  records: UsageRecord[];
  coverage: UsageCoverage;
  unattributedInvocations: number;
  notes: string[];
}
