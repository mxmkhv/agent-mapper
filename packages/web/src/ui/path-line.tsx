import { splitPath } from "../model/paths";

/** The directory truncates first so the filename always stays visible. */
export function PathLine({ path, title }: { path: string; title?: string }) {
  const { directory, file } = splitPath(path);
  return (
    <span
      className="flex min-w-0 overflow-hidden font-mono text-mono text-ink-faint"
      title={title ?? path}
    >
      <span className="truncate">{directory}</span>
      <span className="shrink-0 text-ink-muted">{file}</span>
    </span>
  );
}
