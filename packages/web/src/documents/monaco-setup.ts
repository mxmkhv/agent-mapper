/**
 * Loaded only when editing or reviewing starts. Imports the editor core, the contributions an
 * editor and diff view need, and the Markdown tokenizer; no language services or CDN loader.
 */
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/features/codicon/register";
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/browser/widget/codeEditor/codeEditorWidget";
import "monaco-editor/editor/browser/widget/diffEditor/diffEditor.contribution";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/editor/contrib/readOnlyMessage/browser/contribution";
import "monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode";
import "monaco-editor/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter";
import "monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import "monaco-editor/editor/common/standaloneStrings";
import "monaco-editor/features/find/register";
import "monaco-editor/languages/definitions/markdown/register";

self.MonacoEnvironment = {
  // Only the editor worker is bundled, from this origin; it computes diffs off the UI thread.
  getWorker: () =>
    new Worker(new URL("./editor.worker.ts", import.meta.url), {
      type: "module"
    })
};

const themeTokens = {
  "editor.background": "--am-surface",
  "editor.foreground": "--am-ink",
  "editorLineNumber.foreground": "--am-ink-faint",
  "editorLineNumber.activeForeground": "--am-ink-muted",
  "editor.lineHighlightBackground": "--am-wash",
  "editor.selectionBackground": "--am-selected",
  "editorCursor.foreground": "--am-ink",
  "editorIndentGuide.background1": "--am-hairline",
  "editorWidget.background": "--am-surface",
  "editorWidget.border": "--am-hairline-strong",
  focusBorder: "--am-focus"
} as const;

/** Monaco accepts only 6- or 8-digit hex; minified CSS may shorten `#ffffff` to `#fff`. */
function monacoColor(value: string): string | undefined {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3,4}$/i.test(hex)) {
    return `#${[...hex].map((digit) => digit + digit).join("")}`;
  }
  return /^(?:[\da-f]{6}|[\da-f]{8})$/i.test(hex) ? `#${hex}` : undefined;
}

/** Builds the editor theme from the resolved `--am-*` tokens on <html data-theme>. */
export function applyTheme(): void {
  const style = getComputedStyle(document.documentElement);
  const dark = document.documentElement.dataset.theme === "dark";
  const colors = Object.fromEntries(
    Object.entries(themeTokens).flatMap(([key, token]) => {
      const color = monacoColor(style.getPropertyValue(token));
      return color ? [[key, color]] : [];
    })
  );
  monaco.editor.defineTheme("agent-mapper", {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors
  });
  monaco.editor.setTheme("agent-mapper");
}

const models = new Map<string, monaco.editor.ITextModel>();

/** One model per draft, so typing undo survives leaving and reopening the editor. */
export function draftModel(
  sourceKey: string,
  text: string
): monaco.editor.ITextModel {
  let model = models.get(sourceKey);
  if (!model || model.isDisposed()) {
    model = monaco.editor.createModel(text, "markdown");
    models.set(sourceKey, model);
  }
  return model;
}

export function disposeDraftModel(sourceKey: string): void {
  models.get(sourceKey)?.dispose();
  models.delete(sourceKey);
}

export { monaco };
