/**
 * Monaco's look, kept from before the editor moved to CodeMirror: the app's surface, ink and selection tokens, with Monaco's
 * `vs` and `vs-dark` token, diff and find colors. Both palettes are CSS variables, so the editor follows <html data-theme>.
 */
import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { bracketTags, htmlDelimiterTag, htmlStringTag } from "./syntax-tokens";

/** [light, dark] pairs from Monaco's themes and color registry. */
const palette = {
  keyword: ["#0000ff", "#569cd6"],
  comment: ["#008000", "#608b4e"],
  string: ["#a31515", "#ce9178"],
  variable: ["#001188", "#74b0df"],
  number: ["#098658", "#b5cea8"],
  metatag: ["#e00000", "#dd6a6f"],
  key: ["#863b00", "#9cdcfe"],
  tag: ["#800000", "#569cd6"],
  "attribute-name": ["#ff0000", "#9cdcfe"],
  "html-string": ["#0000ff", "#ce9178"],
  "html-delimiter": ["#383838", "#808080"],
  "bracket-0": ["#0431fa", "#ffd700"],
  "bracket-1": ["#319331", "#da70d6"],
  "bracket-2": ["#7b3814", "#179fff"],
  "inserted-text": ["#9ccc2c40", "#9ccc2c33"],
  "diagonal-fill": ["#22222233", "#cccccc33"],
  "current-match": ["#a8ac94", "#515c6a"],
  "inactive-selection": ["#e5ebf1", "#3a3d41"],
  "bracket-match-border": ["#b9b9b9", "#888888"],
  "fold-icon": ["#424242", "#c5c5c5"],
  "widget-foreground": ["#616161", "#cccccc"],
  "input-background": ["#ffffff", "#3c3c3c"],
  "toolbar-hover": ["#b8b8b850", "#5a5d5e50"]
} as const;
type PaletteName = keyof typeof palette;

/** A Monaco color as a CSS variable; the find widget reads the same `--monaco-*` variables through Tailwind. */
const monacoColor = (name: PaletteName) => `var(--monaco-${name})`;

const variables = (scheme: 0 | 1) =>
  Object.fromEntries(
    Object.entries(palette).map(([name, pair]) => [
      `--monaco-${name}`,
      pair[scheme]
    ])
  );

const removed = "#ff000033";
const insertedLine = "rgba(155, 185, 85, 0.2)";

export const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: monacoColor("keyword") },
  { tag: tags.comment, color: monacoColor("comment") },
  { tag: tags.string, color: monacoColor("string") },
  { tag: tags.variableName, color: monacoColor("variable") },
  { tag: tags.number, color: monacoColor("number") },
  { tag: tags.meta, color: monacoColor("metatag") },
  { tag: tags.propertyName, color: monacoColor("key") },
  { tag: tags.tagName, color: monacoColor("tag") },
  { tag: tags.attributeName, color: monacoColor("attribute-name") },
  { tag: htmlStringTag, color: monacoColor("html-string") },
  { tag: htmlDelimiterTag, color: monacoColor("html-delimiter") },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.invalid, color: "rgba(255, 18, 18, 0.8)" },
  { tag: bracketTags[0], color: monacoColor("bracket-0") },
  { tag: bracketTags[1], color: monacoColor("bracket-1") },
  { tag: bracketTags[2], color: monacoColor("bracket-2") }
]);

export const editorTheme = EditorView.theme({
  "&": {
    ...variables(0),
    height: "100%",
    color: "var(--am-ink)",
    backgroundColor: "var(--am-surface)",
    fontSize: "13px"
  },
  ":root[data-theme=dark] &": variables(1),
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "20px" },
  ".cm-content": { padding: "0", caretColor: "var(--am-ink)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid var(--am-ink)" },
  ".cm-selectionBackground": {
    backgroundColor: monacoColor("inactive-selection")
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--am-selected)"
  },
  ".cm-activeLine": { backgroundColor: "var(--am-wash)" },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in oklab, var(--am-selected) 60%, transparent)"
  },
  ".cm-searchMatch": { backgroundColor: "rgba(234, 92, 0, 0.33)" },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: monacoColor("current-match")
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "#0064001a",
    outline: `1px solid ${monacoColor("bracket-match-border")}`
  },
  ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "transparent"
  },
  ".cm-gutters": {
    backgroundColor: "var(--am-surface)",
    color: "var(--am-ink-faint)",
    border: "none"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "39px",
    padding: "0",
    textAlign: "right"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--am-ink-muted)"
  },
  // Monaco shows fold controls while the pointer is over the gutter; a folded line keeps its control.
  ".cm-foldGutter .cm-gutterElement": {
    width: "26px",
    paddingLeft: "2px",
    color: monacoColor("fold-icon")
  },
  ".cm-fold-marker": {
    display: "flex",
    height: "20px",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    opacity: "0",
    transition: "opacity 0.5s"
  },
  ".cm-gutters:hover .cm-fold-marker, .cm-fold-marker[data-folded]": {
    opacity: "1"
  },
  ".cm-foldPlaceholder": {
    margin: "0 0.2em",
    border: "none",
    backgroundColor: "transparent",
    color: "#808080"
  },
  // The find widget floats at the top right of a band Monaco keeps clear above the first line.
  ".cm-panels": { backgroundColor: "transparent", color: "inherit" },
  ".cm-panels.cm-panels-top": { borderBottom: "none" },
  ".cm-tooltip": {
    backgroundColor: "var(--am-surface)",
    border: "1px solid var(--am-hairline-strong)",
    color: "var(--am-ink)"
  },
  "&.cm-merge-a .cm-changedLine, .cm-deletedChunk": {
    backgroundColor: removed
  },
  "&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine": {
    backgroundColor: insertedLine
  },
  "&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText":
    { background: removed },
  "&.cm-merge-b .cm-changedText": {
    background: monacoColor("inserted-text")
  },
  ".cm-deletedChunk": { paddingLeft: "0" },
  // Monaco marks changed lines with − and + beside the line numbers instead of a colored bar.
  ".cm-changeGutter": { width: "14px", paddingLeft: "0" },
  ".cm-changeGutter .cm-gutterElement": { textAlign: "center" },
  "&.cm-merge-a .cm-changedLineGutter, .cm-deletedLineGutter, &.cm-merge-b .cm-changedLineGutter":
    { background: "none" },
  "&.cm-merge-a .cm-changedLineGutter::before": { content: '"−"' },
  "&.cm-merge-b .cm-changedLineGutter::before": { content: '"+"' },
  // Where one side has no lines, Monaco fills the gap with diagonal stripes.
  ".cm-mergeSpacer": {
    backgroundImage: `linear-gradient(-45deg, ${monacoColor("diagonal-fill")} 12.5%, transparent 12.5%, transparent 50%, ${monacoColor("diagonal-fill")} 50%, ${monacoColor("diagonal-fill")} 62.5%, transparent 62.5%, transparent 100%)`,
    backgroundSize: "8px 8px"
  }
});
