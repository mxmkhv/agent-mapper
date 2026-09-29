import type { InventoryEntry, ToolId } from "./inventory";

// Browser-safe contract for reading, editing and restoring one instruction or skill file.

export type SourceScope = "global" | "project";

/** Selects an entry from a context this server has already scanned. */
export interface SourceRef {
  scope: SourceScope;
  workingDirectory: string;
  entryId: string;
}

export interface SourceDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export type LineEnding = "lf" | "crlf" | "mixed" | "none";

export interface ImpactAssociation {
  scope: SourceScope;
  workingDirectory: string;
  entryId: string;
  tool: ToolId;
  path: string;
  availability: "expected" | "shadowed" | "not-applicable" | "unknown";
  reason: string;
  scannedAt: string;
}

export interface SourceImpact {
  /** Only contexts this server scanned are known; unscanned projects may also use the file. */
  coverage: "scanned-contexts-only";
  aliases: string[];
  contexts: ImpactAssociation[];
}

interface SourceDocumentOrigin {
  entryId: string;
  tool: ToolId;
  kind: InventoryEntry["kind"];
  name: string;
  path: string;
  scope: InventoryEntry["scope"];
  pluginId?: string;
}

export interface SourceDocument {
  documentId: string;
  /** Stable across restarts: SHA-256 of the canonical real path. Drafts and history share it across aliases. */
  sourceKey: string;
  source: SourceDocumentOrigin;
  canonicalPath: string;
  version: string;
  /** Text without a BOM; CRLF files arrive as LF. The server restores both on save. Mixed-ending files keep their `\r` and are read-only. */
  content: string;
  encoding: { bom: boolean };
  lineEnding: LineEnding;
  editable: boolean;
  readOnlyReason?: string;
  diagnostics: SourceDiagnostic[];
  impact: SourceImpact;
  historyDirectory: string;
}

export interface ContentRequest {
  documentId: string;
  sourceKey: string;
  expectedVersion: string;
  content: string;
}

export interface RestoreRequest {
  documentId: string;
  sourceKey: string;
  expectedVersion: string;
  revisionId: string;
}

export interface ValidationResult {
  diagnostics: SourceDiagnostic[];
  impact: SourceImpact;
  currentVersion: string;
  /** Disk already holds exactly these bytes, whatever the expected version was. */
  unchanged: boolean;
}

export interface RevisionSummary {
  revisionId: string;
  capturedAt: string;
  kind: "before-save" | "before-restore";
  hash: string;
  bytes: number;
  /** The captured bytes equal the file on disk now. */
  current: boolean;
}

export interface RevisionHistory {
  revisions: RevisionSummary[];
  /** Damaged snapshots or an unreadable current file; the readable revisions are still listed. */
  problems: string[];
}

export interface RevisionContent {
  revision: RevisionSummary;
  content: string;
  diagnostics: SourceDiagnostic[];
}

export interface MutationResult {
  sourceKey: string;
  outcome: "saved" | "unchanged";
  /** Absent only when the write committed but reading it back failed; reopen before editing again. */
  document?: SourceDocument;
  /** The snapshot of the bytes this write replaced. */
  revisionId?: string;
  warnings?: string[];
}

export type DocumentErrorCode =
  | "invalid_request"
  | "unknown_source"
  | "read_only"
  | "not_found"
  | "too_large"
  | "invalid_encoding"
  | "validation_failed"
  | "conflict"
  | "busy"
  | "history_unavailable"
  | "io_error";

export interface DocumentError {
  code: DocumentErrorCode;
  message: string;
  retryable: boolean;
  diagnostics?: SourceDiagnostic[];
}
