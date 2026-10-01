import { lazy } from "react";

/** CodeMirror loads with the first editor or diff; the Markdown renderer with the first preview. */
export const SourceEditor = lazy(() =>
  import("./source-editor").then((module) => ({
    default: module.SourceEditor
  }))
);

export const SourceDiff = lazy(() =>
  import("./source-editor").then((module) => ({ default: module.SourceDiff }))
);

export const MarkdownPreview = lazy(() =>
  import("./markdown-preview").then((module) => ({
    default: module.MarkdownPreview
  }))
);
