import { useState } from "react";
import { PixelIcon } from "../ui/pixel-icon";
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
        className="flex h-[26px] items-center gap-2.5 px-2 text-left text-label text-ink-muted hover:bg-wash hover:text-ink"
        onClick={() => setOpen(!open)}
      >
        <PixelIcon name={open ? "chevron-down" : "chevron-right"} />
        Removed
        <span className="font-mono text-mono text-ink-faint">
          {paths.length}
        </span>
      </button>
      {open
        ? paths.map((path) => (
            <div
              className="flex h-[26px] items-center gap-2 pr-1 pl-[29px] hover:bg-wash"
              key={path}
            >
              <span
                className="min-w-0 flex-1 truncate font-mono text-mono text-ink-muted"
                title={path}
              >
                {folderName(path)}
              </span>
              <button
                aria-label={`Restore ${folderName(path)}`}
                className="px-1.5 py-0.5 text-caption font-semibold text-ink-muted hover:bg-ink hover:text-canvas"
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
