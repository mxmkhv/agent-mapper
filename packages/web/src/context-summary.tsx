import type { ContextSummary, ToolId } from "@agent-mapper/core";

interface Props {
  context: ContextSummary;
  tool: "all" | ToolId;
}

function estimate(value: number): string {
  return `~${value.toLocaleString()}`;
}

export function ContextSummaryPanel({ context, tool }: Props) {
  const tools: ToolId[] = tool === "all" ? ["claude", "codex"] : [tool];
  return (
    <section
      className="context-summary"
      aria-label="Approximate context volume"
    >
      <div className="context-heading">
        <strong>Approximate context volume</strong>
        <span>Characters ÷ 4, not billed tokens</span>
      </div>
      <div className="context-cards">
        {tools.map((selected) => {
          const row = context[selected];
          return (
            <div className="context-card" key={selected}>
              <strong>{selected === "claude" ? "Claude Code" : "Codex"}</strong>
              <dl>
                <div>
                  <dt>Startup text</dt>
                  <dd>{estimate(row.startup)}</dd>
                </div>
                <div>
                  <dt>Skill and command metadata</dt>
                  <dd>{estimate(row.skillMetadata)}</dd>
                </div>
                <div>
                  <dt>Available on demand</dt>
                  <dd>{estimate(row.onDemand)}</dd>
                </div>
              </dl>
              <p>
                {row.unaccountedSources} sources with unaccounted loading or
                size
              </p>
            </div>
          );
        })}
      </div>
      <p className="context-caption">
        Startup covers resolved instruction files. On demand covers available
        skill and command bodies and configured agent files. Metadata is file
        text; listing budgets and other runtime content are not estimated.
      </p>
    </section>
  );
}
