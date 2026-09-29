import type {
  ContentRequest,
  DocumentError,
  DocumentErrorCode,
  MutationResult,
  RestoreRequest,
  RevisionContent,
  RevisionSummary,
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
  }) {
    super(failure.message);
    this.code = failure.code;
    this.retryable = failure.retryable;
    this.diagnostics = failure.diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const hasText = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((key) => typeof value[key] === "string");

function isDocumentError(value: unknown): value is DocumentError {
  return isRecord(value) && hasText(value, ["code", "message"]);
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

function isHistory(value: unknown): value is RevisionSummary[] {
  return (
    Array.isArray(value) &&
    value.every(
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

async function send(
  action: string,
  request: { body: object; signal?: AbortSignal }
): Promise<Response> {
  try {
    return await fetch(`/api/source-document/${action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken()}`
      },
      body: JSON.stringify(request.body),
      signal: request.signal
    });
  } catch (error) {
    if (request.signal?.aborted) {
      throw error;
    }
    throw new DocumentRequestError({
      code: "network",
      message:
        "Could not reach the local server, so the result is unknown. Retry sends the same reviewed text.",
      retryable: true
    });
  }
}

async function post<T>(
  action: string,
  request: {
    body: object;
    signal?: AbortSignal;
    valid(value: unknown): value is T;
  }
): Promise<T> {
  const response = await send(action, request);
  const payload: unknown = await response.json();
  if (!response.ok) {
    throw failureFrom(payload, response.status);
  }
  if (!request.valid(payload)) {
    throw new DocumentRequestError({
      code: "io_error",
      message:
        "The local server returned an unexpected response. Restart agent-mapper.",
      retryable: false
    });
  }
  return payload;
}

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

export function sourceHistory(documentId: string): Promise<RevisionSummary[]> {
  return post("history", { body: { documentId }, valid: isHistory });
}

export function sourceRevision(input: {
  documentId: string;
  revisionId: string;
}): Promise<RevisionContent> {
  return post("revision", { body: input, valid: isRevision });
}
