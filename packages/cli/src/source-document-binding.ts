import { join } from "node:path";
import type { SourceDocument } from "@agent-mapper/core";
import { documentError } from "./source-document-errors";
import {
  canonicalTarget,
  readOnlyReason,
  readTarget,
  type TargetState
} from "./source-document-reader";
import type {
  DocumentHandle,
  SourceDocumentRegistry
} from "./source-document-registry";
import { validateEntry } from "./source-document-validation";

/** A document handle checked against the latest scan and the file currently on disk. */
export interface Bound {
  handle: DocumentHandle;
  target: TargetState;
  readOnlyRoots: string[];
}

const expiredDocument = () =>
  documentError(
    "unknown_source",
    "This document session expired. Rescan and reopen the source."
  );

export function handleFor(
  registry: SourceDocumentRegistry,
  documentId: string
): DocumentHandle {
  const handle = registry.handle(documentId);
  if (!handle) {
    throw expiredDocument();
  }
  return handle;
}

/** Re-resolves a handle against the latest scan and the current link chain. */
export async function bindDocument(
  registry: SourceDocumentRegistry,
  request: { documentId: string; sourceKey: string }
): Promise<Bound> {
  const handle = handleFor(registry, request.documentId);
  if (handle.sourceKey !== request.sourceKey) {
    throw documentError(
      "invalid_request",
      "This request names a different file than its document. Reopen the source."
    );
  }
  const found = registry.lookup(handle.ref);
  if (!found || found.item.entry.path !== handle.entry.path) {
    throw documentError(
      "unknown_source",
      "This source is no longer in the latest scan. Rescan, then reopen it."
    );
  }
  const canonicalPath = await canonicalTarget(handle.entry.path);
  if (canonicalPath !== handle.canonicalPath) {
    throw documentError(
      "conflict",
      `${handle.entry.path} now points to ${canonicalPath} instead of ${handle.canonicalPath}. Nothing was written; reopen the source to edit the new target.`
    );
  }
  return {
    handle,
    target: await readTarget(canonicalPath),
    readOnlyRoots: found.readOnlyRoots
  };
}

export async function describeDocument(
  bound: Bound,
  context: { registry: SourceDocumentRegistry; historyRoot: string }
): Promise<SourceDocument> {
  const { handle, target } = bound;
  const { entry } = handle;
  const reason = await readOnlyReason({
    entry,
    target,
    readOnlyRoots: bound.readOnlyRoots
  });
  return {
    documentId: handle.documentId,
    sourceKey: handle.sourceKey,
    source: {
      entryId: entry.id,
      tool: entry.tool,
      kind: entry.kind,
      name: entry.name,
      path: entry.path,
      scope: entry.scope,
      pluginId: entry.pluginId
    },
    canonicalPath: target.canonicalPath,
    version: target.version,
    content: target.decoded.content,
    encoding: { bom: target.decoded.bom },
    lineEnding: target.decoded.lineEnding,
    editable: !reason,
    readOnlyReason: reason,
    diagnostics: validateEntry(target.decoded.content, entry),
    impact: context.registry.impact(target.canonicalPath),
    historyDirectory: join(context.historyRoot, handle.sourceKey)
  };
}
