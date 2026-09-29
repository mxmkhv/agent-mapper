import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";

/** Path entry until the local server offers the native macOS folder picker. */
export function AddFolder({ onAdd }: { onAdd(path: string): void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      input.current?.focus();
    }
  }, [open]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = draft.trim();
    if (path) {
      onAdd(path);
      setDraft("");
      setOpen(false);
    }
  }
  if (!open) {
    return (
      <button
        className="flex h-[30px] items-center gap-2 rounded-control px-2 text-left hover:bg-hover"
        onClick={() => setOpen(true)}
      >
        <Plus
          aria-hidden="true"
          className="size-4 text-ink-muted"
          strokeWidth={1.6}
        />
        Add folder…
      </button>
    );
  }
  return (
    <form className="grid gap-1.5 px-2 py-1" onSubmit={submit}>
      <label
        className="text-caption font-semibold text-ink-muted"
        htmlFor="folder-path"
      >
        Folder path
      </label>
      <input
        className="h-7 min-w-0 rounded-control border border-hairline bg-surface px-2 font-mono text-mono text-ink"
        id="folder-path"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        placeholder="~/Developer/project"
        ref={input}
        value={draft}
      />
      <div className="flex gap-1.5">
        <button
          className="h-6 rounded-control bg-ink px-2 text-caption font-semibold text-canvas"
          type="submit"
        >
          Scan folder
        </button>
        <button
          className="h-6 px-2 text-caption text-ink-muted"
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
