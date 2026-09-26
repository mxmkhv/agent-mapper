import { useState } from "react";
import type { PluginRecord } from "@agent-mapper/core";
import { sourceAction } from "./api";

interface PluginListProps {
  plugins: PluginRecord[];
  selectedId?: string;
  onSelect(id: string): void;
}

export function PluginList({ plugins, selectedId, onSelect }: PluginListProps) {
  if (plugins.length === 0) {
    return (
      <div className="empty-list">
        <h3>No plugins in this view</h3>
        <p>Try the other tool filter or select a project.</p>
      </div>
    );
  }
  return (
    <div className="source-list">
      {plugins.map((plugin) => (
        <button
          key={plugin.id}
          className={`source-row ${selectedId === plugin.id ? "selected" : ""}`}
          onClick={() => onSelect(plugin.id)}
        >
          <span className={`tool-dot ${plugin.tool}`} aria-hidden="true" />
          <span className="source-main">
            <strong>{plugin.name}</strong>
            <small>
              {plugin.marketplace ?? "unknown source"} ·{" "}
              {plugin.version ?? "version unknown"}
            </small>
          </span>
          <span className={`state-badge ${plugin.state}`}>{plugin.state}</span>
        </button>
      ))}
    </div>
  );
}

interface PluginDetailProps {
  plugin?: PluginRecord;
  workingDirectory: string;
  onOpenEntry(id: string): void;
}

export function PluginDetail({
  plugin,
  workingDirectory,
  onOpenEntry
}: PluginDetailProps) {
  const [actionError, setActionError] = useState<{
    pluginId: string;
    message: string;
  }>();
  if (!plugin) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          Select a plugin to inspect its sources.
        </div>
      </aside>
    );
  }
  async function run(action: "open" | "reveal") {
    if (!plugin) {
      return;
    }
    try {
      setActionError(undefined);
      await sourceAction({ path: workingDirectory, id: plugin.id, action });
    } catch (error) {
      setActionError({
        pluginId: plugin.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return (
    <aside className="detail" key={plugin.id}>
      <div className="detail-top">
        <span className="eyebrow">PLUGIN DETAILS</span>
        <h2>{plugin.name}</h2>
        <div className="detail-tags">
          <span>{plugin.tool === "claude" ? "Claude Code" : "Codex"}</span>
          <span>{plugin.scope}</span>
          <span>{plugin.version ?? "version unknown"}</span>
        </div>
      </div>
      <section className="detail-section">
        <h3>Resolution</h3>
        <p className={`state-line ${plugin.state}`}>{plugin.state}</p>
        <p>{plugin.reason}</p>
      </section>
      <section className="detail-section">
        <h3>Sources</h3>
        <p className="source-path">{plugin.installPath ?? plugin.sourcePath}</p>
        {plugin.installationEvidence ? (
          <p>Installation: {plugin.installationEvidence}</p>
        ) : null}
        {plugin.settingsEvidence ? (
          <p>Settings: {plugin.settingsEvidence}</p>
        ) : null}
      </section>
      {plugin.issues?.length ? (
        <section className="detail-section">
          <h3>Inspection warnings</h3>
          {plugin.issues.map((issue) => (
            <p className="inline-error" key={issue}>
              {issue}
            </p>
          ))}
        </section>
      ) : null}
      <section className="detail-section">
        <h3>Discovered contributions · {plugin.contributions.length}</h3>
        {plugin.contributions.length ? (
          <div className="contribution-list">
            {plugin.contributions.map((item) =>
              item.entryId ? (
                <button
                  key={`${item.kind}:${item.name}:${item.sourcePath}`}
                  onClick={() => onOpenEntry(item.entryId!)}
                >
                  {item.kind} · {item.name} ↗
                </button>
              ) : (
                <span
                  key={`${item.kind}:${item.name}:${item.sourcePath}`}
                  title={item.sourcePath}
                >
                  {item.kind} · {item.name}
                </span>
              )
            )}
          </div>
        ) : (
          <p>No supported declarations found in this copy.</p>
        )}
        <p>Counts are discovered declarations, not runtime capabilities.</p>
      </section>
      <div className="detail-actions">
        <button onClick={() => void run("open")}>Open source</button>
        <button onClick={() => void run("reveal")}>Reveal in Finder</button>
      </div>
      {actionError?.pluginId === plugin.id ? (
        <p className="inline-error" role="alert">
          {actionError.message}
        </p>
      ) : null}
    </aside>
  );
}
