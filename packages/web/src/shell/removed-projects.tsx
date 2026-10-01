import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { folderName } from "./project-list";

/** Projects removed from the sidebar. Collapsed by default so it stays out of the way. */
export function RemovedProjects({
  paths,
  onRestore
}: {
  paths: string[];
  onRestore(path: string): void;
}) {
  const [open, setOpen] = useState(false);
  if (!paths.length) {
    return null;
  }
  return (
    <div className="grid gap-0.5">
      <button
        aria-expanded={open}
        className="flex h-[26px] items-center gap-1 rounded-control px-2 text-left text-label text-ink-muted hover:bg-hover hover:text-ink"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          strokeWidth={1.8}
        />
        Removed
        <span className="text-ink-faint tabular-nums">{paths.length}</span>
      </button>
      {open
        ? paths.map((path) => (
            <div
              className="flex h-[26px] items-center gap-2 pr-1 pl-7 text-label"
              key={path}
            >
              <span
                className="min-w-0 flex-1 truncate text-ink-muted"
                title={path}
              >
                {folderName(path)}
              </span>
              <button
                aria-label={`Restore ${folderName(path)}`}
                className="rounded-control px-1.5 py-0.5 text-caption font-semibold text-ink-muted hover:bg-hover hover:text-ink"
                onClick={() => onRestore(path)}
              >
                Restore
              </button>
            </div>
          ))
        : null}
    </div>
  );
}
