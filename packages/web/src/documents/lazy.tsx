import { lazy } from "react";

/** Monaco and the Markdown renderer load only when a document is shown or edited. */
export const SourceEditor = lazy(() =>
  import("./monaco-editor").then((module) => ({
    default: module.SourceEditor
  }))
);

export const SourceDiff = lazy(() =>
  import("./monaco-editor").then((module) => ({ default: module.SourceDiff }))
);

export const MarkdownPreview = lazy(() =>
  import("./markdown-preview").then((module) => ({
    default: module.MarkdownPreview
  }))
);
