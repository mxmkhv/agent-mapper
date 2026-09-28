import { useState, type KeyboardEvent } from "react";
import { isLink } from "../model/links";
import { shortPath, type PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { KindIcon, kindSingular } from "../ui/kind-icon";
import { StateMarker, SymlinkBadge } from "../ui/marks";
import { PathLine } from "../ui/path-line";
import { searchRecords } from "./search";

const arrowStep = new Map([
  ["ArrowDown", 1],
  ["ArrowUp", -1]
]);

interface SearchPaletteProps {
  records: InventoryRecord[];
  context: PathContext;
  toolName: string;
  onPick(id: string): void;
  onClose(): void;
}

export function SearchPalette({
  records,
  context,
  toolName,
  onPick,
  onClose
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const results = searchRecords(records, query);
  const active = Math.min(index, results.length - 1);
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    const step = arrowStep.get(event.key);
    if (event.key === "Escape") {
      onClose();
    } else if (step) {
      event.preventDefault();
      setIndex(Math.max(0, Math.min(results.length - 1, active + step)));
    } else if (event.key === "Enter" && results[active]) {
      onPick(results[active].id);
    }
  }
  return (
    <div className="fixed inset-0 z-20 grid place-items-start justify-center bg-black/20 pt-[12vh]">
      <button
        aria-label="Close search"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <dialog
        aria-label="Search"
        className="relative m-0 w-[min(640px,92vw)] overflow-hidden rounded-dialog border border-hairline bg-surface p-0 text-ink shadow-dialog"
        open
      >
        <input
          aria-label={`Search ${toolName} inventory`}
          autoFocus
          className="h-12 w-full border-0 border-b border-hairline bg-transparent px-4 text-[15px] text-ink outline-none"
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={keyDown}
          placeholder={`Search ${toolName} skills, hooks, MCP servers, files…`}
          value={query}
        />
        <div className="max-h-[50vh] overflow-auto p-1.5">
          {results.length === 0 ? (
            <p className="py-8 text-center text-ink-faint">
              No matches for {toolName}.
            </p>
          ) : null}
          {results.map((record, position) => (
            <button
              className={`grid h-9 w-full grid-cols-[16px_10px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-button px-3 text-left ${position === active ? "bg-selected" : "hover:bg-hover"}`}
              key={record.id}
              onClick={() => onPick(record.id)}
              onMouseEnter={() => setIndex(position)}
            >
              <KindIcon kind={record.kind} />
              <StateMarker tier={record.tier} />
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className={`shrink-0 font-semibold ${record.tier === "inactive" ? "text-ink-muted" : ""}`}
                >
                  {record.name}
                </span>
                <PathLine
                  path={record.pluginPath ?? shortPath(record.path, context)}
                />
              </span>
              <span>{isLink(record) ? <SymlinkBadge /> : null}</span>
              <span className="text-caption text-ink-muted">
                {kindSingular[record.kind]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-3.5 border-t border-hairline px-3.5 py-2 text-caption text-ink-faint">
          <span>↑↓ navigate</span>
          <span>↵ inspect</span>
          <span>esc close</span>
        </div>
      </dialog>
    </div>
  );
}
