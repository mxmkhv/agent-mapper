import { splitPath } from "../model/paths";

/**
 * The directory gives up space first (losing its start), and only then does the filename truncate, so the folder nearest
 * the file (usually the one that tells rows apart) survives. RTL direction moves the ellipsis to the
 * left; the LRM marks keep leading dots and tildes in place.
 */
export function PathLine({ path, title }: { path: string; title?: string }) {
  const { directory, file } = splitPath(path);
  return (
    <span
      className="flex min-w-0 overflow-hidden font-mono text-mono text-ink-faint"
      title={title ?? path}
    >
      <span className="min-w-0 shrink-[1000] truncate [direction:rtl]">{`\u200e${directory}\u200e`}</span>
      <span className="min-w-0 truncate text-ink-muted">{file}</span>
    </span>
  );
}
