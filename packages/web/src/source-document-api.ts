import type {
  ContentRequest,
  DocumentError,
  DocumentErrorCode,
  HistoryReveal,
  MutationResult,
  RestoreRequest,
  RevisionContent,
  RevisionHistory,
  SourceDiagnostic,
  SourceDocument,
  SourceRef,
  ValidationResult
} from "@agent-mapper/core";
import { sessionToken } from "./api";

type FailureCode = DocumentErrorCode | "network" | "session";

/** A failed document request, keeping the server's code so the UI can offer the right recovery. */
export class DocumentRequestError extends Error {
  readonly code: FailureCode;
  readonly retryable: boolean;
  readonly diagnostics?: SourceDiagnostic[];

  constructor(failure: {
    code: FailureCode;
    message: string;
    retryable: boolean;
    diagnostics?: SourceDiagnostic[];
    cause?: unknown;
  }) {
    super(failure.message, { cause: failure.cause });
    this.code = failure.code;
    this.retryable = failure.retryable;
    this.diagnostics = failure.diagnostics;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const hasText = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((key) => typeof value[key] === "string");

const errorCodes = new Set<string>([
  "invalid_request",
  "unknown_source",
  "read_only",
  "not_found",
  "too_large",
  "invalid_encoding",
  "validation_failed",
  "conflict",
  "busy",
  "history_unavailable",
  "io_error"
] satisfies DocumentErrorCode[]);

function isDocumentError(value: unknown): value is DocumentError {
  return (
    isRecord(value) &&
    hasText(value, ["code", "message"]) &&
    errorCodes.has(String(value.code)) &&
    typeof value.retryable === "boolean"
  );
}

function isDocument(value: unknown): value is SourceDocument {
  return (
    isRecord(value) &&
    hasText(value, ["documentId", "sourceKey", "version", "content"]) &&
    typeof value.editable === "boolean" &&
    isRecord(value.impact)
  );
}

function isValidation(value: unknown): value is ValidationResult {
  return (
    isRecord(value) &&
    Array.isArray(value.diagnostics) &&
    typeof value.currentVersion === "string" &&
    isRecord(value.impact)
  );
}

function isMutation(value: unknown): value is MutationResult {
  return (
    isRecord(value) &&
    (value.outcome === "saved" || value.outcome === "unchanged") &&
    (value.document === undefined || isDocument(value.document))
  );
}

function isHistory(value: unknown): value is RevisionHistory {
  return (
    isRecord(value) &&
    Array.isArray(value.problems) &&
    Array.isArray(value.revisions) &&
    value.revisions.every(
      (item) => isRecord(item) && hasText(item, ["revisionId", "capturedAt"])
    )
  );
}

function isRevision(value: unknown): value is RevisionContent {
  return (
    isRecord(value) &&
    typeof value.content === "string" &&
    isRecord(value.revision)
  );
}

/** Document routes use `{error: {code, message}}`; auth and origin checks still use `{error: string}`. */
function failureFrom(payload: unknown, status: number): DocumentRequestError {
  const error = isRecord(payload) ? payload.error : undefined;
  if (isDocumentError(error)) {
    return new DocumentRequestError(error);
  }
  return new DocumentRequestError({
    code: "session",
    message:
      typeof error === "string"
        ? error
        : `Request failed with status ${status}. Reopen agent-mapper.`,
    retryable: false
  });
}

const unknownResult = (cause: unknown) =>
  new DocumentRequestError({
    code: "network",
    message:
      "Could not reach the local server, so the result is unknown. Check that agent-mapper is still running, then try again.",
    retryable: true,
    cause
  });

async function send(
  path: string,
  request: { body: object; signal?: AbortSignal }
): Promise<Response> {
  // A missing token is a broken session link, not a network problem; let its message through.
  const token = sessionToken();
  try {
    return await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(request.body),
      signal: request.signal
    });
  } catch (error) {
    if (request.signal?.aborted) {
      throw error;
    }
    throw unknownResult(error);
  }
}

/** POSTs to a local route that replies with a payload or the `{error: {code, message}}` envelope. */
export async function postJson<T>(
  path: string,
  request: {
    body: object;
    signal?: AbortSignal;
    valid(value: unknown): value is T;
  }
): Promise<T> {
  const response = await send(path, request);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (request.signal?.aborted) {
      throw error;
    }
    // The body was cut off or unreadable, so whether the request took effect is unknown.
    throw unknownResult(error);
  }
  if (!response.ok) {
    throw failureFrom(payload, response.status);
  }
  if (!request.valid(payload)) {
    throw new DocumentRequestError({
      code: "io_error",
      message:
        "The local server returned an unexpected response. Rebuild and restart agent-mapper.",
      retryable: false
    });
  }
  return payload;
}

const post = <T>(
  action: string,
  request: Parameters<typeof postJson<T>>[1]
): Promise<T> => postJson(`/api/source-document/${action}`, request);

export function openSourceDocument(
  ref: SourceRef,
  signal?: AbortSignal
): Promise<SourceDocument> {
  return post("open", { body: ref, signal, valid: isDocument });
}

export function validateSourceDocument(
  request: ContentRequest
): Promise<ValidationResult> {
  return post("validate", { body: request, valid: isValidation });
}

export function saveSourceDocument(
  request: ContentRequest
): Promise<MutationResult> {
  return post("save", { body: request, valid: isMutation });
}

export function restoreSourceRevision(
  request: RestoreRequest
): Promise<MutationResult> {
  return post("restore", { body: request, valid: isMutation });
}

export function sourceHistory(documentId: string): Promise<RevisionHistory> {
  return post("history", { body: { documentId }, valid: isHistory });
}

function isReveal(value: unknown): value is HistoryReveal {
  return isRecord(value) && value.revealed === true;
}

/** Asks the local server to show this document's saved-versions folder in the file manager. */
export function revealSourceHistory(
  documentId: string
): Promise<HistoryReveal> {
  return post("reveal-history", { body: { documentId }, valid: isReveal });
}

export function sourceRevision(input: {
  documentId: string;
  revisionId: string;
}): Promise<RevisionContent> {
  return post("revision", { body: input, valid: isRevision });
}
