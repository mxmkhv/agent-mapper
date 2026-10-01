import type { SourceDocument } from "@agent-mapper/core";

type Located = Pick<SourceDocument, "canonicalPath">;

/** Codex agents are TOML; every other document is Markdown. */
export const isToml = (document: Located) =>
  document.canonicalPath.endsWith(".toml");

/** Monaco ships no TOML tokenizer; INI colors its keys, strings, tables and `#` comments well enough. */
export const editorLanguage = (document: Located) =>
  isToml(document) ? "ini" : "markdown";

export type EditorLanguage = ReturnType<typeof editorLanguage>;
