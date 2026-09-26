import { useState, type KeyboardEvent } from "react";
import type { InventorySnapshot, ToolId } from "@agent-mapper/core";
import { searchItems, type SearchItem } from "./search";

interface Props {
  snapshot: InventorySnapshot;
  tool: "all" | ToolId;
  onOpen(item: SearchItem): void;
  onClose(): void;
}

export function SearchPalette({ snapshot, tool, onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = searchItems(snapshot, { query, tool });
  const selected = Math.min(selectedIndex, results.length - 1);

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[selected]) {
      onOpen(results[selected]);
    }
  }

  return (
    <div className="search-backdrop">
      <button
        className="search-backdrop-dismiss"
        aria-label="Close search"
        onClick={onClose}
      />
      <dialog open className="search-palette" aria-label="Search inventory">
        <label htmlFor="inventory-search">Search all inventory views</label>
        <input
          id="inventory-search"
          autoFocus
          type="search"
          placeholder="Name or source path"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={keyDown}
        />
        <p className="search-hint">
          {{ all: "Both tools", claude: "Claude Code", codex: "Codex" }[tool]} ·
          Enter to open · Esc to close
        </p>
        {results.length ? (
          <div className="search-results">
            {results.map((item, index) => (
              <button
                key={`${item.tab}:${item.id}`}
                className={index === selected ? "selected" : ""}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onOpen(item)}
              >
                <span className={`tool-dot ${item.tool}`} aria-hidden="true" />
                <span className="search-result-main">
                  <strong>{item.title}</strong>
                  <small>{item.path}</small>
                </span>
                <span className="search-result-kind">{item.tab}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="search-empty">No matching inventory items.</div>
        )}
      </dialog>
    </div>
  );
}
