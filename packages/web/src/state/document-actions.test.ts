import type {
  MutationResult,
  SourceDocument,
  SourceRef,
  ValidationResult
} from "@agent-mapper/core";
import { beforeEach, expect, it, vi } from "vitest";
import {
  DocumentRequestError,
  openSourceDocument,
  restoreSourceRevision,
  saveSourceDocument,
  validateSourceDocument
} from "../source-document-api";
import { restoreRevision, reviewDraft, saveReviewed } from "./document-actions";
import { DraftStore } from "./draft-store";

vi.mock("../source-document-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../source-document-api")>()),
  openSourceDocument: vi.fn(),
  validateSourceDocument: vi.fn(),
  saveSourceDocument: vi.fn(),
  restoreSourceRevision: vi.fn()
}));

const ref: SourceRef = {
  scope: "project",
  workingDirectory: "/repo",
  entryId: "e"
};

function document(content: string, version: string): SourceDocument {
  return {
    documentId: `doc-${version}`,
    sourceKey: "key",
    source: {
      entryId: "e",
      tool: "claude",
      kind: "instruction",
      name: "CLAUDE.md",
      path: "/repo/CLAUDE.md",
      scope: "project"
    },
    canonicalPath: "/repo/CLAUDE.md",
    version,
    content,
    encoding: { bom: false },
    lineEnding: "lf",
    editable: true,
    diagnostics: [],
    impact: { coverage: "scanned-contexts-only", aliases: [], contexts: [] },
    historyDirectory: "/history/key"
  };
}

const validation: ValidationResult = {
  diagnostics: [],
  impact: { coverage: "scanned-contexts-only", aliases: [], contexts: [] },
  currentVersion: "v1",
  unchanged: false
};
const networkError = () =>
  new DocumentRequestError({
    code: "network",
    message: "Offline.",
    retryable: true
  });
const saved = (content: string, version: string): MutationResult => ({
  sourceKey: "key",
  outcome: "saved",
  document: document(content, version),
  revisionId: "r"
});

let store: DraftStore;
const context = () => ({ store, sourceKey: "key", onMutated: vi.fn() });

beforeEach(() => {
  vi.mocked(validateSourceDocument).mockReset().mockResolvedValue(validation);
  vi.mocked(saveSourceDocument).mockReset();
  vi.mocked(openSourceDocument).mockReset();
  vi.mocked(restoreSourceRevision).mockReset();
  store = new DraftStore();
  store.load(document("base\n", "v1"), ref);
});

async function editAndReview(text: string) {
  store.setText("key", text);
  await reviewDraft(context());
}

it("saves exactly the reviewed text and adopts the written file", async () => {
  await editAndReview("reviewed\n");
  vi.mocked(saveSourceDocument).mockResolvedValue(saved("reviewed\n", "v2"));
  await saveReviewed(context());
  expect(vi.mocked(saveSourceDocument).mock.calls[0]?.[0]).toMatchObject({
    content: "reviewed\n",
    expectedVersion: "v1"
  });
  expect(store.get("key")).toMatchObject({
    phase: "editing",
    text: "reviewed\n"
  });
});

it("keeps new edits after a lost response, a conflict and Continue editing", async () => {
  await editAndReview("first\n");
  vi.mocked(saveSourceDocument).mockRejectedValueOnce(networkError());
  await saveReviewed(context());
  expect(store.get("key")).toMatchObject({
    phase: "reviewing",
    outcomeUnknown: true
  });
  // The lost save landed; reopening sees a newer version under the dirty draft.
  store.load(document("first\n", "v2"), ref);
  store.backToEdit("key");
  store.setText("key", "second\n");
  store.load(document("other\n", "v3"), ref);
  expect(store.get("key")?.phase).toBe("conflict");
  store.rebase("key");
  await editAndReview("second\n");
  vi.mocked(saveSourceDocument).mockResolvedValue(saved("second\n", "v4"));
  await saveReviewed(context());
  expect(vi.mocked(saveSourceDocument).mock.lastCall?.[0]).toMatchObject({
    content: "second\n",
    expectedVersion: "v3"
  });
  expect(store.get("key")?.text).toBe("second\n");
});

it("turns a stale save into a conflict and keeps the draft", async () => {
  await editAndReview("mine\n");
  vi.mocked(saveSourceDocument).mockRejectedValue(
    new DocumentRequestError({
      code: "conflict",
      message: "Changed.",
      retryable: false
    })
  );
  vi.mocked(openSourceDocument).mockResolvedValue(document("theirs\n", "v2"));
  await saveReviewed(context());
  expect(store.get("key")).toMatchObject({
    phase: "conflict",
    text: "mine\n",
    review: undefined
  });
});

it("reports busy as an error, not a conflict", async () => {
  await editAndReview("mine\n");
  vi.mocked(saveSourceDocument).mockRejectedValue(
    new DocumentRequestError({
      code: "busy",
      message: "In progress.",
      retryable: true
    })
  );
  await saveReviewed(context());
  expect(store.get("key")).toMatchObject({
    phase: "reviewing",
    error: "In progress."
  });
  expect(openSourceDocument).not.toHaveBeenCalled();
});

it("reopens when the server could not read back, and says so if that fails too", async () => {
  await editAndReview("mine\n");
  vi.mocked(saveSourceDocument).mockResolvedValue({
    sourceKey: "key",
    outcome: "saved",
    revisionId: "r",
    warnings: ["Could not read it back."]
  });
  vi.mocked(openSourceDocument).mockRejectedValue(new Error("Gone."));
  await saveReviewed(context());
  const draft = store.get("key");
  expect(draft?.phase).toBe("editing");
  expect(draft?.error).toMatch(
    /^Saved\. Could not read it back\. Reopening the file failed: Gone\./
  );
});

it("ignores a review that finishes after the draft was discarded", async () => {
  store.setText("key", "throwaway\n");
  const pending = reviewDraft(context());
  store.discard("key");
  await pending;
  expect(store.get("key")).toMatchObject({
    phase: "editing",
    text: "base\n",
    review: undefined
  });
});

it("reports a restore conflict as not done", async () => {
  vi.mocked(restoreSourceRevision).mockRejectedValue(
    new DocumentRequestError({
      code: "conflict",
      message: "Changed.",
      retryable: false
    })
  );
  vi.mocked(openSourceDocument).mockResolvedValue(document("theirs\n", "v2"));
  const done = await restoreRevision({ ...context(), revisionId: "r" });
  expect(done).toBe(false);
  expect(store.get("key")?.phase).toBe("conflict");
});
