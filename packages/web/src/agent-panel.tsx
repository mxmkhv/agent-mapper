import { useState } from "react";
import type { AgentRecord } from "@agent-mapper/core";
import { sourceAction } from "./api";

interface AgentListProps {
  agents: AgentRecord[];
  selectedId?: string;
  onSelect(id: string): void;
}

export function AgentList({ agents, selectedId, onSelect }: AgentListProps) {
  if (!agents.length) {
    return (
      <div className="empty-list">
        <h3>No local agents in this view</h3>
        <p>Try the other tool filter or select a project.</p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {agents.map((agent) => (
        <button
          key={agent.id}
          className={`source-row ${selectedId === agent.id ? "selected" : ""}`}
          onClick={() => onSelect(agent.id)}
        >
          <span className={`tool-dot ${agent.tool}`} aria-hidden="true" />
          <span className="source-main">
            <strong>{agent.name}</strong>
            <small>
              {agent.tool === "claude" ? "Claude Code" : "Codex"} ·{" "}
              {agent.scope} · {agent.format}
            </small>
          </span>
          <span className={`state-badge ${agent.availability}`}>
            {agent.availability}
          </span>
        </button>
      ))}
    </div>
  );
}

interface AgentDetailProps {
  agent?: AgentRecord;
  workingDirectory: string;
  onSelectPlugin(id: string): void;
}

export function AgentDetail({
  agent,
  workingDirectory,
  onSelectPlugin
}: AgentDetailProps) {
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  }>();
  if (!agent) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select an agent to inspect its declaration.
        </div>
      </aside>
    );
  }
  async function run(action: "open" | "reveal") {
    if (!agent) {
      return;
    }
    try {
      setActionError(undefined);
      await sourceAction({ path: workingDirectory, id: agent.id, action });
    } catch (error) {
      setActionError({
        id: agent.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return (
    <aside className="detail" key={agent.id}>
      <div className="detail-top">
        <span className="eyebrow">AGENT DETAILS</span>
        <h2>{agent.name}</h2>
        <div className="detail-tags">
          <span>{agent.tool === "claude" ? "Claude Code" : "Codex"}</span>
          <span>{agent.scope}</span>
          <span>{agent.format}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Expected state</h3>
        <p className={`state-line ${agent.availability}`}>
          {agent.availability}
        </p>
        <p>{agent.reason}</p>
      </section>
      <section className="detail-section">
        <h3>Declaration</h3>
        <p>Locator: {agent.locator}</p>
        <p>Description: {agent.descriptionPresent ? "present" : "not found"}</p>
        <p>Read state: {agent.readState}</p>
        <p className="source-path">{agent.sourcePath}</p>
        <p>Instructions stay in the source file.</p>
      </section>
      {agent.pluginId ? (
        <section className="detail-section">
          <button
            className="text-link"
            onClick={() => onSelectPlugin(agent.pluginId!)}
          >
            View parent plugin ↗
          </button>
        </section>
      ) : null}
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open source</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError?.id === agent.id ? (
        <p className="inline-error" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </aside>
  );
}
