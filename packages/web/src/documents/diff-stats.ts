import type { Chunk } from "@codemirror/merge";
import type { Text } from "@codemirror/state";

/**
 * Monaco diffed in a worker with a 5 s budget. CodeMirror diffs on the UI thread, so the budget is 1 s; past it, the diff
 * falls back to coarser chunks. Without this, @codemirror/merge falls back after about 500 changed characters.
 */
export const diffConfig = { timeout: 1000 };

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

/** The lines a chunk covers on one side. Its `to` sits one past the last line, or equals `from` when that side has none. */
function chunkLines(doc: Text, range: { from: number; to: number }): string[] {
  if (range.to <= range.from) {
    return [];
  }
  const first = doc.lineAt(range.from).number;
  const last = doc.lineAt(range.to - 1).number;
  return Array.from(
    { length: last - first + 1 },
    (_, index) => doc.line(first + index).text
  );
}

/**
 * Chunks are found by character, so text added after a last line without a line break also covers that unchanged line.
 * Matching lines at either end are dropped to count lines the way a line diff does.
 */
function changedLines(before: string[], after: string[]) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1;
  }
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  return {
    removed: before.length - start - end,
    added: after.length - start - end
  };
}

/** Undefined when any chunk came from the coarser fallback diff, whose line counts would overstate the change. */
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
    const { added, removed } = changedLines(
      chunkLines(original, { from: chunk.fromA, to: chunk.toA }),
      chunkLines(modified, { from: chunk.fromB, to: chunk.toB })
    );
    stats.added += added;
    stats.removed += removed;
    stats.changed += Math.max(added, removed);
  }
  return stats;
}
