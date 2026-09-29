import { join } from "node:path";
import type {
  ContentRequest,
  InventorySnapshot,
  MutationResult,
  RestoreRequest,
  RevisionContent,
  RevisionSummary,
  SourceDocument,
  SourceRef,
  SourceScope,
  ValidationResult
} from "@agent-mapper/core";
import {
  bindDocument,
  describeDocument,
  handleFor,
  type Bound
} from "./source-document-binding";
import {
  decodeDocument,
  encodeDocument,
  hashBytes,
  sourceKeyFor
} from "./source-document-bytes";
import { DocumentApiError, documentError } from "./source-document-errors";
import {
  historyFolder,
  listSnapshots,
  readSnapshot
} from "./source-document-history";
import {
  canonicalTarget,
  readOnlyReason,
  readTarget
} from "./source-document-reader";
import { SourceDocumentRegistry } from "./source-document-registry";
import {
  blockingDiagnostics,
  validateDocument
} from "./source-document-validation";
import { commitMutation, type MutationPlan } from "./source-document-writer";

/** Reads, validates, saves and restores instruction and skill files from registered scans. */
export class SourceDocumentService {
  private readonly registry: SourceDocumentRegistry;
  private readonly busy = new Set<string>();

  constructor(
    private readonly options: { managedRoot: string; historyRoot: string }
  ) {
    this.registry = new SourceDocumentRegistry(options.managedRoot);
  }

  register(scope: SourceScope, snapshot: InventorySnapshot): void {
    this.registry.register(scope, snapshot);
  }

  async open(ref: SourceRef): Promise<SourceDocument> {
    const found = this.registry.lookup(ref);
    if (!found) {
      throw documentError(
        "unknown_source",
        "This source is not in the latest scan. Rescan and try again."
      );
    }
    const { entry } = found.item;
    if (entry.kind !== "instruction" && entry.kind !== "skill") {
      throw documentError(
        "invalid_request",
        "Only instructions and skills can be opened here."
      );
    }
    if (entry.inlineContent || entry.declarationOnly) {
      throw documentError(
        "invalid_request",
        "This entry is declared inside another file and has no file of its own. Use Open instead."
      );
    }
    const canonicalPath = await canonicalTarget(entry.path);
    const target = await readTarget(canonicalPath);
    const handle = {
      ref,
      sourceKey: sourceKeyFor(canonicalPath),
      canonicalPath,
      entry
    };
    const documentId = this.registry.createHandle(handle);
    return this.describe({
      handle: { ...handle, documentId },
      target,
      readOnlyRoots: found.readOnlyRoots
    });
  }

  /** Equal bytes are reported as unchanged even with a stale version, so a retry can reconcile. */
  async validate(request: ContentRequest): Promise<ValidationResult> {
    const bound = await bindDocument(this.registry, request);
    const { target } = bound;
    const unchanged = encodeDocument(request.content, target.decoded).equals(
      target.bytes
    );
    if (!unchanged && target.version !== request.expectedVersion) {
      throw documentError(
        "conflict",
        "The file changed on disk since you opened it. Reopen it to compare with your draft."
      );
    }
    return {
      diagnostics: validateDocument(request.content, bound.handle.entry.kind),
      impact: this.registry.impact(target.canonicalPath),
      currentVersion: target.version,
      unchanged
    };
  }

  save(request: ContentRequest): Promise<MutationResult> {
    return this.mutate(request, ({ handle }) => ({
      expectedVersion: request.expectedVersion,
      kind: "before-save",
      proposed: (current) => encodeDocument(request.content, current.decoded),
      check: () => {
        const diagnostics = validateDocument(
          request.content,
          handle.entry.kind
        );
        if (blockingDiagnostics(diagnostics)) {
          throw new DocumentApiError("validation_failed", {
            message: "Fix the frontmatter errors before saving.",
            diagnostics
          });
        }
      }
    }));
  }

  /** Restores recorded bytes exactly, even if they fail today's validation. */
  restore(request: RestoreRequest): Promise<MutationResult> {
    return this.mutate(request, async ({ handle }) => {
      const folder = await historyFolder(
        this.options.historyRoot,
        handle.sourceKey
      );
      const revision = await readSnapshot(folder, {
        revisionId: request.revisionId,
        sourceKey: handle.sourceKey
      });
      return {
        expectedVersion: request.expectedVersion,
        kind: "before-restore",
        proposed: () => revision.bytes
      };
    });
  }

  async history(documentId: string): Promise<RevisionSummary[]> {
    const handle = handleFor(this.registry, documentId);
    const target = await readTarget(handle.canonicalPath);
    const current = hashBytes(target.bytes);
    const revisions = await listSnapshots(
      join(this.options.historyRoot, handle.sourceKey),
      handle.sourceKey
    );
    return revisions.map(({ summary }) => ({
      ...summary,
      current: summary.hash === current
    }));
  }

  async revision(input: {
    documentId: string;
    revisionId: string;
  }): Promise<RevisionContent> {
    const handle = handleFor(this.registry, input.documentId);
    const revision = await readSnapshot(
      join(this.options.historyRoot, handle.sourceKey),
      { revisionId: input.revisionId, sourceKey: handle.sourceKey }
    );
    const decoded = decodeDocument(revision.bytes);
    if (!decoded) {
      throw documentError(
        "invalid_encoding",
        "This saved version is not UTF-8 text and cannot be shown."
      );
    }
    const target = await readTarget(handle.canonicalPath);
    return {
      revision: {
        ...revision.summary,
        current: revision.summary.hash === hashBytes(target.bytes)
      },
      content: decoded.content,
      diagnostics: validateDocument(decoded.content, handle.entry.kind)
    };
  }

  /** Eligibility is rechecked before any shortcut: equal text never permits writing a read-only file. */
  private async mutate(
    request: { documentId: string; sourceKey: string },
    planFor: (bound: Bound) => MutationPlan | Promise<MutationPlan>
  ): Promise<MutationResult> {
    const bound = await bindDocument(this.registry, request);
    const reason = await readOnlyReason({
      entry: bound.handle.entry,
      target: bound.target,
      readOnlyRoots: bound.readOnlyRoots
    });
    if (reason) {
      throw documentError("read_only", reason);
    }
    return commitMutation(
      {
        bound: {
          sourceKey: bound.handle.sourceKey,
          entryPath: bound.handle.entry.path,
          target: bound.target
        },
        historyRoot: this.options.historyRoot,
        busy: this.busy,
        describe: (target) => this.describe({ ...bound, target })
      },
      await planFor(bound)
    );
  }

  private describe(bound: Bound): Promise<SourceDocument> {
    return describeDocument(bound, {
      registry: this.registry,
      historyRoot: this.options.historyRoot
    });
  }
}
