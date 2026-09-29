import type { SourceDocument, SourceRef } from "@agent-mapper/core";
import { expect, it } from "vitest";
import { DraftStore, isDirty } from "./draft-store";

const ref: SourceRef = {
  scope: "project",
  workingDirectory: "/repo",
  entryId: "claude"
};

function document(content: string, version: string): SourceDocument {
  return {
    documentId: `doc-${version}`,
    sourceKey: "key",
    source: {
      entryId: "claude",
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

it("keeps dirty text when the same file is reopened", () => {
  const store = new DraftStore();
  store.load(document("base\n", "v1"), ref);
  store.setText("key", "edited\n");
  store.load(document("base\n", "v1"), { ...ref, entryId: "codex" });
  const draft = store.get("key");
  expect(draft?.text).toBe("edited\n");
  expect(draft?.document.documentId).toBe("doc-v1");
  expect(store.sourceKeyFor({ ...ref, entryId: "codex" })).toBe("key");
});

it("turns a newer disk version under a dirty draft into a conflict", () => {
  const store = new DraftStore();
  store.load(document("base\n", "v1"), ref);
  store.setText("key", "edited\n");
  store.load(document("external\n", "v2"), ref);
  const draft = store.get("key");
  expect(draft?.phase).toBe("conflict");
  expect(draft?.text).toBe("edited\n");
  expect(draft?.document.version).toBe("v1");
  expect(draft?.conflict?.version).toBe("v2");
});

it("replaces a clean draft with the fresh file", () => {
  const store = new DraftStore();
  store.load(document("base\n", "v1"), ref);
  store.load(document("saved elsewhere\n", "v2"), ref);
  const draft = store.get("key");
  expect(draft?.text).toBe("saved elsewhere\n");
  expect(draft && isDirty(draft)).toBe(false);
});

it("discards onto the current file and notifies subscribers", () => {
  const store = new DraftStore();
  let changes = 0;
  store.subscribe(() => {
    changes += 1;
  });
  store.load(document("base\n", "v1"), ref);
  store.setText("key", "edited\n");
  store.load(document("external\n", "v2"), ref);
  const before = store.snapshot();
  store.discard("key");
  expect(store.snapshot()).not.toBe(before);
  expect(store.get("key")).toMatchObject({
    text: "external\n",
    phase: "editing",
    conflict: undefined
  });
  expect(changes).toBe(4);
});
