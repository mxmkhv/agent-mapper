import type { SourceDiagnostic } from "@agent-mapper/core";

/** Frontmatter findings. Errors block a save; warnings only inform. */
export function Diagnostics({
  diagnostics
}: {
  diagnostics: readonly SourceDiagnostic[];
}) {
  if (!diagnostics.length) {
    return null;
  }
  return (
    <ul className="mt-2 mb-0 grid list-none gap-1 p-0 text-label">
      {diagnostics.map((item) => (
        <li
          className={
            item.severity === "error" ? "text-problem" : "text-ink-muted"
          }
          key={`${item.code}:${item.line ?? 0}:${item.column ?? 0}`}
        >
          <strong>{item.severity === "error" ? "Error" : "Warning"}</strong>
          {item.line ? ` · line ${item.line}` : ""}: {item.message}
        </li>
      ))}
    </ul>
  );
}
