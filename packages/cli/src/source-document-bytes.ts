import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import type { LineEnding } from "@agent-mapper/core";

/** Largest document, in raw bytes, that can be opened or saved. */
export const maxDocumentBytes = 1_048_576;
const bom = Buffer.from("\uFEFF", "utf8");
const versionLength = 32;
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export interface DocumentFormat {
  bom: boolean;
  lineEnding: LineEnding;
}

export interface DecodedDocument extends DocumentFormat {
  /** Text without the BOM; CRLF files are converted to LF, mixed endings are left as they are. */
  content: string;
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sourceKeyFor(canonicalPath: string): string {
  return createHash("sha256").update(canonicalPath, "utf8").digest("hex");
}

/**
 * Covers the bytes and the file identity. A content hash alone would miss a link
 * retargeted to another file with equal text, or an inode swapped underneath us.
 */
export function versionFor(
  target: { canonicalPath: string; stats: Stats },
  bytes: Uint8Array
): string {
  return createHash("sha256")
    .update(
      `${target.canonicalPath}\0${target.stats.dev}\0${target.stats.ino}\0`
    )
    .update(bytes)
    .digest("hex")
    .slice(0, versionLength);
}

function detectLineEnding(text: string): LineEnding {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = text.match(/(?<!\r)\n/g)?.length ?? 0;
  const cr = text.match(/\r(?!\n)/g)?.length ?? 0;
  if (cr || (crlf && lf)) {
    return "mixed";
  }
  if (crlf) {
    return "crlf";
  }
  return lf ? "lf" : "none";
}

/** Returns undefined for invalid UTF-8 or NUL bytes, which this release does not edit. */
export function decodeDocument(bytes: Uint8Array): DecodedDocument | undefined {
  const hasBom =
    bytes.length >= bom.length && bom.every((byte, i) => bytes[i] === byte);
  let text: string;
  try {
    text = decoder.decode(hasBom ? bytes.subarray(bom.length) : bytes);
  } catch {
    // TextDecoder signals invalid UTF-8 only by throwing; the caller reports it as invalid_encoding.
    return undefined;
  }
  if (text.includes("\0")) {
    return undefined;
  }
  const lineEnding = detectLineEnding(text);
  return {
    bom: hasBom,
    lineEnding,
    content: lineEnding === "crlf" ? text.replaceAll("\r\n", "\n") : text
  };
}

/** Applies the file's original BOM and uniform line ending to LF-normalized editor text. */
export function encodeDocument(
  content: string,
  format: DocumentFormat
): Buffer {
  const normalized = content.replace(/\r\n?/g, "\n");
  const text =
    format.lineEnding === "crlf"
      ? normalized.replaceAll("\n", "\r\n")
      : normalized;
  const body = Buffer.from(text, "utf8");
  return format.bom ? Buffer.concat([bom, body]) : body;
}
