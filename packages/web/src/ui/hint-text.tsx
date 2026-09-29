import { isPathLike } from "../model/paths";

/** A layer hint such as `~/.codex · ~/.agents` or "Repo and parent folders": paths in mono, prose in sans. */
export function HintText({
  hint,
  stacked = false
}: {
  hint: string;
  stacked?: boolean;
}) {
  const parts = hint.split(" · ");
  return (
    <span className={stacked ? "grid gap-0.5" : "inline"}>
      {parts.map((part, index) => (
        <span
          className={`text-caption font-normal break-words text-ink-faint ${isPathLike(part) ? "font-mono" : "font-sans"}`}
          key={part}
        >
          {!stacked && index ? " · " : null}
          {part}
        </span>
      ))}
    </span>
  );
}
