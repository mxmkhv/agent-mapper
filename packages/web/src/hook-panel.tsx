import { useState } from "react";
import type { HookLane, HookRecord } from "@agent-mapper/core";
import { sourceAction } from "./api";

const lanes: HookLane[] = [
  "Session start",
  "Prompt submit",
  "Before tool",
  "Permission",
  "After tool",
  "Subagent",
  "Compact",
  "Stop",
  "Session end",
  "Other"
];

interface HookListProps {
  hooks: HookRecord[];
  selectedId?: string;
  onSelect(id: string): void;
}

export function HookList({ hooks, selectedId, onSelect }: HookListProps) {
  if (!hooks.length) {
    return (
      <div className="empty-list">
        <h3>No hooks in this view</h3>
        <p>Try the other tool filter or select a project.</p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {lanes.map((lane) => {
        const group = hooks.filter((hook) => hook.lane === lane);
        return group.length ? (
          <div key={lane}>
            <div className="hook-lane">{lane}</div>
            {group.map((hook) => (
              <button
                key={hook.id}
                className={`source-row ${selectedId === hook.id ? "selected" : ""}`}
                onClick={() => onSelect(hook.id)}
              >
                <span className={`tool-dot ${hook.tool}`} aria-hidden="true" />
                <span className="source-main">
                  <strong>{hook.event}</strong>
                  <small>
                    {hook.handlerType} · {hook.matcher ?? "all matches"}
                  </small>
                </span>
                <span className={`state-badge ${hook.availability}`}>
                  {hook.availability}
                </span>
              </button>
            ))}
          </div>
        ) : null;
      })}
    </div>
  );
}

interface HookDetailProps {
  hook?: HookRecord;
  workingDirectory: string;
  onSelectPlugin(id: string): void;
}

export function HookDetail({
  hook,
  workingDirectory,
  onSelectPlugin
}: HookDetailProps) {
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  }>();
  if (!hook) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select a hook to inspect its declaration.
        </div>
      </aside>
    );
  }
  async function run(action: "open" | "reveal") {
    if (!hook) {
      return;
    }
    try {
      setActionError(undefined);
      await sourceAction({ path: workingDirectory, id: hook.id, action });
    } catch (error) {
      setActionError({
        id: hook.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return (
    <aside className="detail">
      <div className="detail-top">
        <span className="eyebrow">HOOK DETAILS</span>
        <h2>{hook.event}</h2>
        <div className="detail-tags">
          <span>{hook.tool === "claude" ? "Claude Code" : "Codex"}</span>
          <span>{hook.scope}</span>
          <span>{hook.lane}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Applicability</h3>
        <p className={`state-line ${hook.availability}`}>{hook.availability}</p>
        <p>{hook.reason}</p>
      </section>
      <section className="detail-section">
        <h3>Declaration</h3>
        <p>Handler: {hook.handlerType}</p>
        <p>Matcher: {hook.matcher ?? "all matches"}</p>
        {hook.condition ? <p>Condition: {hook.condition}</p> : null}
        {hook.flags.length ? <p>Flags: {hook.flags.join(" · ")}</p> : null}
        <p className="source-path">{hook.sourcePath}</p>
        <p className="hook-locator">{hook.locator}</p>
        {hook.pluginId ? (
          <button
            className="source-link"
            onClick={() => onSelectPlugin(hook.pluginId!)}
          >
            View parent plugin ↗
          </button>
        ) : null}
      </section>
      <section className="detail-section">
        <p>
          Handler content stays in the source file. Open it to inspect the
          command, URL, or prompt.
        </p>
      </section>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open source</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError?.id === hook.id ? (
        <p className="inline-error" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </aside>
  );
}
