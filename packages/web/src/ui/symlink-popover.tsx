import { useId } from "react";
import { FolderOpen } from "lucide-react";
import { splitPath } from "../model/paths";
import { useSourceAction } from "../state/use-source-action";
import { Button } from "./button";
import { PathText } from "./path-text";
import { SymlinkGlyph, symlinkChip } from "./marks";

interface SymlinkPopoverProps {
  /** The linked entry, and the scanned folder that lists it. */
  id: string;
  workingDirectory: string;
  /** The `~` path of the file the link resolves to. */
  target: string;
}

/**
 * The symlink chip as a button: its popover names the folder the link resolves into and opens it in Finder.
 * A native popover, so Escape and an outside click close it; CSS anchors it under the chip.
 */
export function SymlinkPopover({
  id,
  workingDirectory,
  target
}: SymlinkPopoverProps) {
  const popoverId = useId();
  const anchor = `--symlink-${popoverId.replace(/\W/g, "")}`;
  const action = useSourceAction(workingDirectory);
  const error = action.errorFor(id);
  return (
    <>
      <button
        className={`${symlinkChip} relative hover:border-link`}
        popoverTarget={popoverId}
        style={{ anchorName: anchor }}
        title={`Symlink → ${target}`}
        type="button"
      >
        <SymlinkGlyph />
        symlink
      </button>
      <div
        className="inset-auto top-[anchor(bottom)] left-[anchor(left)] m-0 mt-1.5 w-[min(340px,90vw)] rounded-panel border border-hairline bg-surface p-3 text-left text-ink shadow-dialog [position-try-fallbacks:flip-block,flip-inline]"
        id={popoverId}
        popover="auto"
        style={{ positionAnchor: anchor }}
      >
        <p className="m-0 text-caption font-semibold text-ink-muted">
          Symlink to
        </p>
        <p className="m-0 mt-1 font-mono text-mono break-words">
          <PathText path={splitPath(target).directory} />
        </p>
        <Button
          className="mt-2.5"
          onClick={() => void action.run(id, "reveal-target")}
        >
          <FolderOpen
            aria-hidden="true"
            className="size-3.5"
            strokeWidth={1.8}
          />
          Open in Finder
        </Button>
        {error ? (
          <p className="m-0 mt-2 text-label text-problem" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
