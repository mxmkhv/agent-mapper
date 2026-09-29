import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type {
  ImpactAssociation,
  InventoryEntry,
  InventorySnapshot,
  ResolvedEntry,
  SourceImpact,
  SourceRef,
  SourceScope
} from "@agent-mapper/core";

/** Every open creates a handle; the least recently used are dropped past this bound, and drafts reopen on demand. */
const maxHandles = 2000;
const documentIdBytes = 16;

interface RegisteredContext {
  scope: SourceScope;
  workingDirectory: string;
  scannedAt: string;
  items: ResolvedEntry[];
  /** Plugin, plugin-cache and managed roots seen by this scan; files resolving inside stay read-only. */
  readOnlyRoots: string[];
}

export interface DocumentHandle {
  documentId: string;
  ref: SourceRef;
  sourceKey: string;
  canonicalPath: string;
  entry: InventoryEntry;
}

const contextKey = (scope: SourceScope, workingDirectory: string) =>
  `${scope}\0${workingDirectory}`;

function readOnlyRoots(
  snapshot: InventorySnapshot,
  managedRoot: string
): string[] {
  return [
    managedRoot,
    join(snapshot.roots.claude, "plugins"),
    join(snapshot.roots.codex, "plugins"),
    ...snapshot.plugins.flatMap((plugin) =>
      plugin.installPath ? [plugin.installPath] : []
    )
  ];
}

/**
 * Remembers the latest scan of each global/project context this server produced.
 * Documents open only through entries of those scans, never by a client-supplied path.
 */
export class SourceDocumentRegistry {
  private readonly contexts = new Map<string, RegisteredContext>();
  private readonly handles = new Map<string, DocumentHandle>();

  constructor(private readonly managedRoot: string) {}

  register(scope: SourceScope, snapshot: InventorySnapshot): void {
    this.contexts.set(contextKey(scope, snapshot.workingDirectory), {
      scope,
      workingDirectory: snapshot.workingDirectory,
      scannedAt: snapshot.scannedAt,
      items: snapshot.items,
      readOnlyRoots: readOnlyRoots(snapshot, this.managedRoot)
    });
  }

  lookup(
    ref: SourceRef
  ): { item: ResolvedEntry; readOnlyRoots: string[] } | undefined {
    const context = this.contexts.get(
      contextKey(ref.scope, ref.workingDirectory)
    );
    const item = context?.items.find(({ entry }) => entry.id === ref.entryId);
    return context && item
      ? { item, readOnlyRoots: context.readOnlyRoots }
      : undefined;
  }

  /** Every known entry, in any scanned context, whose real path is this file. */
  impact(canonicalPath: string): SourceImpact {
    const contexts: ImpactAssociation[] = [];
    for (const context of this.contexts.values()) {
      for (const { entry, resolution } of context.items) {
        if ((entry.realPath ?? entry.path) !== canonicalPath) {
          continue;
        }
        contexts.push({
          scope: context.scope,
          workingDirectory: context.workingDirectory,
          entryId: entry.id,
          tool: entry.tool,
          path: entry.path,
          availability: resolution.availability,
          reason: resolution.reason,
          scannedAt: context.scannedAt
        });
      }
    }
    return {
      coverage: "scanned-contexts-only",
      aliases: [...new Set(contexts.map((context) => context.path))].sort(),
      contexts
    };
  }

  createHandle(handle: Omit<DocumentHandle, "documentId">): string {
    const documentId = randomBytes(documentIdBytes).toString("hex");
    this.handles.set(documentId, { ...handle, documentId });
    if (this.handles.size > maxHandles) {
      const oldest = this.handles.keys().next().value;
      if (oldest !== undefined) {
        this.handles.delete(oldest);
      }
    }
    return documentId;
  }

  /** Using a handle marks it recently used, so a draft that keeps saving is not evicted. */
  handle(documentId: string): DocumentHandle | undefined {
    const handle = this.handles.get(documentId);
    if (handle) {
      this.handles.delete(documentId);
      this.handles.set(documentId, handle);
    }
    return handle;
  }
}
