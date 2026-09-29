import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  ContentRequest,
  DocumentError,
  MutationResult,
  RestoreRequest,
  RevisionContent,
  RevisionHistory,
  SourceDocument,
  SourceRef,
  ValidationResult
} from "@agent-mapper/core";
import { maxDocumentBytes } from "./source-document-bytes";
import { DocumentApiError, documentError } from "./source-document-errors";
import type { SourceDocumentService } from "./source-document-service";

/** Encoded JSON may escape every character, so the body limit is well above the 1 MiB document limit. */
const maxBodyBytes = 8_388_608;
const routePrefix = "/api/source-document/";

type Body = Record<string, unknown>;
type DocumentPayload =
  | SourceDocument
  | ValidationResult
  | MutationResult
  | RevisionHistory
  | RevisionContent;

async function readBody(request: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw documentError(
        "too_large",
        "This request is larger than 8 MiB. Documents are limited to 1 MiB."
      );
    }
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    // JSON.parse reports malformed input only by throwing.
    throw documentError("invalid_request", "The request body is not JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw documentError(
      "invalid_request",
      "The request must be a JSON object."
    );
  }
  // Checked above: a non-null, non-array object.
  return value as Body;
}

function text(body: Body, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value) {
    throw documentError(
      "invalid_request",
      `The request is missing \`${field}\`.`
    );
  }
  return value;
}

function sourceRef(body: Body): SourceRef {
  const scope = text(body, "scope");
  if (scope !== "global" && scope !== "project") {
    throw documentError("invalid_request", "Scope must be global or project.");
  }
  return {
    scope,
    workingDirectory: text(body, "workingDirectory"),
    entryId: text(body, "entryId")
  };
}

function contentRequest(body: Body): ContentRequest {
  const content = body.content;
  if (typeof content !== "string") {
    throw documentError("invalid_request", "The request is missing `content`.");
  }
  if (Buffer.byteLength(content, "utf8") > maxDocumentBytes) {
    throw documentError(
      "too_large",
      "This document is larger than 1 MiB. Shorten it or edit it in another editor."
    );
  }
  return {
    documentId: text(body, "documentId"),
    sourceKey: text(body, "sourceKey"),
    expectedVersion: text(body, "expectedVersion"),
    content
  };
}

function restoreRequest(body: Body): RestoreRequest {
  return {
    documentId: text(body, "documentId"),
    sourceKey: text(body, "sourceKey"),
    expectedVersion: text(body, "expectedVersion"),
    revisionId: text(body, "revisionId")
  };
}

function dispatch(
  service: SourceDocumentService,
  input: { action: string; body: Body }
): Promise<DocumentPayload> {
  const { action, body } = input;
  switch (action) {
    case "open":
      return service.open(sourceRef(body));
    case "validate":
      return service.validate(contentRequest(body));
    case "save":
      return service.save(contentRequest(body));
    case "history":
      return service.history(text(body, "documentId"));
    case "revision":
      return service.revision({
        documentId: text(body, "documentId"),
        revisionId: text(body, "revisionId")
      });
    case "restore":
      return service.restore(restoreRequest(body));
    default:
      throw documentError("not_found", "Unknown document route.");
  }
}

function send(
  response: ServerResponse,
  reply: { status: number; payload: DocumentPayload | { error: DocumentError } }
): void {
  response.writeHead(reply.status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(reply.payload));
}

export function isDocumentRoute(pathname: string): boolean {
  return pathname.startsWith(routePrefix);
}

/**
 * POST routes for one selected document; `server.ts` checks the bearer token, host and origin
 * before dispatching here. Errors use the `{error: {code, message, retryable}}` envelope.
 */
export async function handleDocumentRoute(
  service: SourceDocumentService,
  input: { request: IncomingMessage; response: ServerResponse; url: URL }
): Promise<void> {
  const { request, response, url } = input;
  try {
    if (request.method !== "POST") {
      throw documentError(
        "invalid_request",
        "Document routes accept POST only."
      );
    }
    const body = await readBody(request);
    const payload = await dispatch(service, {
      action: url.pathname.slice(routePrefix.length),
      body
    });
    send(response, { status: 200, payload });
  } catch (error) {
    if (!(error instanceof DocumentApiError)) {
      // An unexpected failure is a bug; keep its stack in the server log. File content never reaches it.
      console.error("agent-mapper: document request failed", error);
    }
    const failure =
      error instanceof DocumentApiError
        ? error
        : documentError(
            "io_error",
            `The document request failed: ${error instanceof Error ? error.message : String(error)}`
          );
    send(response, {
      status: failure.status,
      payload: { error: failure.toPayload() }
    });
  }
}
