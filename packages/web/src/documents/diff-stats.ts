import type { Chunk } from "@codemirror/merge";
import type { Text } from "@codemirror/state";

export interface DiffStats {
  /** Lines touched, counting a replaced line once. */
  changed: number;
  added: number;
  removed: number;
}

interface ChunkedDiff {
  chunks: readonly Chunk[];
  original: Text;
  modified: Text;
}

/** A chunk's `to` sits one past its last line, or equals `from` when that side has no lines. */
function lineCount(doc: Text, range: { from: number; to: number }): number {
  return range.to > range.from
    ? doc.lineAt(range.to - 1).number - doc.lineAt(range.from).number + 1
    : 0;
}

/** Undefined when any chunk came from the imprecise fallback diff, whose line counts would overstate the change. */
export function diffStats({
  chunks,
  original,
  modified
}: ChunkedDiff): DiffStats | undefined {
  const stats = { changed: 0, added: 0, removed: 0 };
  for (const chunk of chunks) {
    if (!chunk.precise) {
      return undefined;
    }
    const added = lineCount(modified, { from: chunk.fromB, to: chunk.toB });
    const removed = lineCount(original, { from: chunk.fromA, to: chunk.toA });
    stats.added += added;
    stats.removed += removed;
    stats.changed += Math.max(added, removed);
  }
  return stats;
}
