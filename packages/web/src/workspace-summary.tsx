import type { InventorySnapshot } from "@agent-mapper/core";

export function WorkspaceSummary({
  snapshot
}: {
  snapshot: InventorySnapshot;
}) {
  return (
    <div className="coverage-note">
      Fresh local CLI model · {snapshot.items.length} sources ·{" "}
      {snapshot.hooks.length} hooks · {snapshot.plugins.length} plugins ·{" "}
      {snapshot.mcpServers.length} MCP servers · {snapshot.agents.length} agents
      · {snapshot.memories.length} memory files ·{" "}
      {snapshot.worktrees.filter((item) => !item.isMain).length} worktrees ·{" "}
      {snapshot.findings.length} findings · Scanned{" "}
      {new Date(snapshot.scannedAt).toLocaleTimeString()}
    </div>
  );
}

export function CoverageNotes({ notes }: { notes: string[] }) {
  if (!notes.length) {
    return null;
  }
  return (
    <details className="coverage">
      <summary>Coverage and scan notes · {notes.length}</summary>
      <ul>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  );
}
