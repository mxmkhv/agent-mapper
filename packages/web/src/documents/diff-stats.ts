import { diff, type Chunk } from "@codemirror/merge";
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

// One UTF-16 unit per distinct line, skipping the surrogate range so every line stays a single unit.
const surrogateStart = 0xd800;
const surrogateCount = 0x800;
const utf16Units = 0x10000;
const lineCodeLimit = utf16Units - surrogateCount;

/**
 * Chunks are found by character, so they can span unchanged lines: a line kept between two edits, or a last line
 * without a line break that text was added after. Diffing the chunk's lines, each encoded as one character, counts
 * only the lines a line diff would. Undefined past 63,488 distinct lines in one chunk.
 */
function lineStats(before: string[], after: string[]): DiffStats | undefined {
  const codes = new Map<string, string>();
  const encode = (lines: string[]) =>
    lines
      .map((line) => {
        let code = codes.get(line);
        if (code === undefined) {
          const index = codes.size;
          code = String.fromCharCode(
            index < surrogateStart ? index : index + surrogateCount
          );
          codes.set(line, code);
        }
        return code;
      })
      .join("");
  const a = encode(before);
  const b = encode(after);
  if (codes.size > lineCodeLimit) {
    return undefined;
  }
  const stats = { changed: 0, added: 0, removed: 0 };
  for (const change of diff(a, b)) {
    const added = change.toB - change.fromB;
    const removed = change.toA - change.fromA;
    stats.added += added;
    stats.removed += removed;
    stats.changed += Math.max(added, removed);
  }
  return stats;
}

/** Undefined when any chunk came from the coarser fallback diff, whose line counts would overstate the change. */
export function diffStats({
  chunks,
  original,
  modified
}: ChunkedDiff): DiffStats | undefined {
  const stats = { changed: 0, added: 0, removed: 0 };
  for (const chunk of chunks) {
    const lines =
      chunk.precise &&
      lineStats(
        chunkLines(original, { from: chunk.fromA, to: chunk.toA }),
        chunkLines(modified, { from: chunk.fromB, to: chunk.toB })
      );
    if (!lines) {
      return undefined;
    }
    stats.added += lines.added;
    stats.removed += lines.removed;
    stats.changed += lines.changed;
  }
  return stats;
}
