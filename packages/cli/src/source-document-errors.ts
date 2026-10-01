import type {
  DocumentError,
  DocumentErrorCode,
  SourceDiagnostic
} from "@agent-mapper/core";

const statusFor: Record<DocumentErrorCode, number> = {
  invalid_request: 400,
  unknown_source: 404,
  not_found: 404,
  read_only: 403,
  too_large: 413,
  invalid_encoding: 422,
  validation_failed: 422,
  conflict: 409,
  busy: 409,
  history_unavailable: 500,
  io_error: 500
};

const retryableCodes = new Set<DocumentErrorCode>(["busy", "io_error"]);

/** A typed, user-facing failure of a document route. Messages never include file content. */
export class DocumentApiError extends Error {
  readonly code: DocumentErrorCode;
  readonly diagnostics?: SourceDiagnostic[];

  constructor(
    code: DocumentErrorCode,
    detail: { message: string; diagnostics?: SourceDiagnostic[] }
  ) {
    super(detail.message);
    this.code = code;
    this.diagnostics = detail.diagnostics;
  }

  get status(): number {
    return statusFor[this.code];
  }

  toPayload(): DocumentError {
    const payload: DocumentError = {
      code: this.code,
      message: this.message,
      retryable: retryableCodes.has(this.code)
    };
    if (this.diagnostics) {
      payload.diagnostics = this.diagnostics;
    }
    return payload;
  }
}

export function documentError(
  code: DocumentErrorCode,
  message: string
): DocumentApiError {
  return new DocumentApiError(code, { message });
}

export function errnoCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** Explains a filesystem failure without echoing anything read from the file. */
export function ioError(error: unknown, action: string): DocumentApiError {
  const code = errnoCode(error);
  if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
    return documentError(
      "read_only",
      `${action} was refused by the filesystem (${code}). Check the file and folder permissions.`
    );
  }
  if (code === "ENOSPC") {
    return documentError(
      "io_error",
      `${action} failed because the disk is full. Free some space and try again.`
    );
  }
  const reason = error instanceof Error ? error.message : String(error);
  return documentError("io_error", `${action} failed: ${reason}`);
}
