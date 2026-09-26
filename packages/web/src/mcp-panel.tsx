import { useState } from "react";
import type { McpRecord } from "@agent-mapper/core";
import { sourceAction } from "./api";

interface McpListProps {
  servers: McpRecord[];
  selectedId?: string;
  onSelect(id: string): void;
}

export function McpList({ servers, selectedId, onSelect }: McpListProps) {
  if (!servers.length) {
    return (
      <div className="empty-list">
        <h3>No local MCP declarations in this view</h3>
        <p>
          Try the other tool filter or select a project. Account and session
          connections are not inspected.
        </p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {servers.map((server) => (
        <button
          key={server.id}
          className={`source-row ${selectedId === server.id ? "selected" : ""}`}
          onClick={() => onSelect(server.id)}
        >
          <span className={`tool-dot ${server.tool}`} aria-hidden="true" />
          <span className="source-main">
            <strong>{server.name}</strong>
            <small>
              {server.transport} · {server.destination}
            </small>
          </span>
          <span
            className={`state-badge ${server.availability.replace(" ", "-")}`}
          >
            {server.availability}
          </span>
        </button>
      ))}
    </div>
  );
}

interface McpDetailProps {
  server?: McpRecord;
  workingDirectory: string;
  onSelectPlugin(id: string): void;
}

export function McpDetail({
  server,
  workingDirectory,
  onSelectPlugin
}: McpDetailProps) {
  const [actionError, setActionError] = useState<{
    id: string;
    message: string;
  }>();
  if (!server) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select a server to inspect its declaration.
        </div>
      </aside>
    );
  }
  async function run(action: "open" | "reveal") {
    if (!server) {
      return;
    }
    try {
      setActionError(undefined);
      await sourceAction({ path: workingDirectory, id: server.id, action });
    } catch (error) {
      setActionError({
        id: server.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return (
    <aside className="detail" key={server.id}>
      <div className="detail-top">
        <span className="eyebrow">MCP SERVER DETAILS</span>
        <h2>{server.name}</h2>
        <div className="detail-tags">
          <span>{server.tool === "claude" ? "Claude Code" : "Codex"}</span>
          <span>{server.scope}</span>
          <span>{server.transport}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Configured state</h3>
        <p className={`state-line ${server.availability.replace(" ", "-")}`}>
          {server.availability}
        </p>
        <p>{server.reason}</p>
      </section>
      <section className="detail-section">
        <h3>Declaration</h3>
        <p>Destination: {server.destination}</p>
        {server.envNames.length ? (
          <p>Environment names: {server.envNames.join(", ")}</p>
        ) : null}
        {server.headerNames.length ? (
          <p>Header names: {server.headerNames.join(", ")}</p>
        ) : null}
        <p className="source-path">{server.sourcePath}</p>
        <p className="hook-locator">{server.locator}</p>
        {server.pluginId ? (
          <button
            className="source-link"
            onClick={() => onSelectPlugin(server.pluginId!)}
          >
            View parent plugin ↗
          </button>
        ) : null}
      </section>
      <section className="detail-section">
        <p>
          Credentials, arguments, paths and full URLs stay in the source file.
          This view does not check connectivity.
        </p>
      </section>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open source</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError?.id === server.id ? (
        <p className="inline-error" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </aside>
  );
}
