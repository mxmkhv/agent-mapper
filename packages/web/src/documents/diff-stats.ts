export interface DiffStats {
  /** Lines touched, counting a replaced line once. */
  changed: number;
  added: number;
  removed: number;
}

/** The shape of Monaco's `ILineChange`: an end line of 0 means that side has no lines in the change. */
export interface LineChange {
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
}

const lineCount = (start: number, end: number) => (end ? end - start + 1 : 0);

export function diffStats(changes: readonly LineChange[]): DiffStats {
  const stats = { changed: 0, added: 0, removed: 0 };
  for (const change of changes) {
    const added = lineCount(
      change.modifiedStartLineNumber,
      change.modifiedEndLineNumber
    );
    const removed = lineCount(
      change.originalStartLineNumber,
      change.originalEndLineNumber
    );
    stats.added += added;
    stats.removed += removed;
    stats.changed += Math.max(added, removed);
  }
  return stats;
}
