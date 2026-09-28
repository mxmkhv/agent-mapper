import { splitPath } from "../model/paths";

/**
 * The filename always stays visible, and the directory loses its start first, so the folder nearest
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
      <span className="truncate [direction:rtl]">{`\u200e${directory}\u200e`}</span>
      <span className="shrink-0 text-ink-muted">{file}</span>
    </span>
  );
}
