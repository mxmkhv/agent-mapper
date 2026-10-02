import type { SourceDocument } from "@agent-mapper/core";

type Located = Pick<SourceDocument, "canonicalPath">;

/** Codex agents are TOML; every other document is Markdown. */
export const isToml = (document: Located) =>
  document.canonicalPath.endsWith(".toml");

export const editorLanguage = (document: Located) =>
  isToml(document) ? "toml" : "markdown";

export type EditorLanguage = ReturnType<typeof editorLanguage>;
