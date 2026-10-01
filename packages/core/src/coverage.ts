/** One part of the configuration and what a local scan of it cannot verify. */
export interface CoverageArea {
  area: string;
  /** Short list for compact views, e.g. the inspector. */
  notVerified: string;
  /** The full note, as printed by the CLI and returned in `snapshot.coverage`. */
  detail: string;
}

export const coverageAreas: readonly CoverageArea[] = [
  {
    area: "Hooks",
    notVerified: "Remote and device policy, activation, project trust",
    detail:
      "Hook coverage includes local managed files and skill and agent frontmatter. Agent Stop hooks become SubagentStop while running as subagents. Remote and device policy selection, activation, project trust, and unsupported declaration shapes are not verified."
  },
  {
    area: "MCP servers",
    notVerified:
      "Remote policy, runtime filters, connections, approval. Servers are never contacted",
    detail:
      "MCP coverage includes readable local managed files. Remote and device policy selection, runtime filters, account and session connections, approval state, and unsupported declaration fields are not verified. Servers are not contacted."
  },
  {
    area: "Memory",
    notVerified:
      "Custom locations, live use. Claude folder matches are candidates",
    detail:
      "Memory coverage includes local Markdown files only. Claude encoded folder names are candidates, not verified project matches; custom memory locations and live use are not resolved."
  },
  {
    area: "Agents",
    notVerified: "Managed and session agents, project trust, live use",
    detail:
      "Agent coverage includes local Claude Markdown and Codex TOML files, plus Claude plugin agent files. Managed and session agents, unsupported declarations, project trust, and live use are not verified. Agent prompts stay in source files."
  },
  {
    area: "Worktrees",
    notVerified:
      "Generated folders, inherited global files, which declaration changed",
    detail:
      "Worktree comparison checks common local configuration files by relative path and content. Generated folders and inherited global files are excluded. A changed settings file does not identify which declaration changed inside it."
  },
  {
    area: "Context",
    notVerified: "Imports, skill listing budgets, memory, settings effects",
    detail:
      "Context figures approximate known file text at four characters per token. Imported instruction content, skill listing budgets, memory loading, settings effects, and other runtime content are not estimated."
  },
  {
    area: "Instructions",
    notVerified: "Custom file settings, trust decisions, runtime overrides",
    detail:
      "Instruction resolution models default Claude Code and Codex file rules. Custom instruction file settings, trust decisions, and runtime overrides are not inspected."
  },
  {
    area: "Claude root",
    notVerified: "CLAUDE_CONFIG_DIR of running sessions",
    detail:
      "Claude user configuration follows CLAUDE_CONFIG_DIR in this process. An existing Claude session may use a different environment."
  },
  {
    area: "Managed",
    notVerified: "Remote, MDM, registry and host policy",
    detail:
      "Local managed Claude instructions are scanned when readable. Remote, MDM, registry, and host policy are not inspected; they may replace or combine with local managed settings."
  },
  {
    area: "Session",
    notVerified: "Runtime flags, account settings, live state",
    detail:
      "This view models a fresh local CLI session. Runtime flags, account-managed settings, and live session state are not inspected."
  }
];

const areaDetails = new Set(coverageAreas.map((area) => area.detail));

/** `snapshot.coverage` lists scan problems before the fixed area notes; this keeps only the problems. */
export function coverageProblems(coverage: readonly string[]): string[] {
  return coverage.filter((note) => !areaDetails.has(note));
}
