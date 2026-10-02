/**
 * The editor's surface, ink, selection and diff colours are the app's tokens. Only syntax keeps hues of its own: Monaco's
 * `vs` and `vs-dark` token colours, darkened or lightened where they fell under 4.5:1 on paper or on the wash of the
 * active line. They are CSS variables, so the editor follows <html data-theme>.
 */
import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { bracketTags, htmlDelimiterTag, htmlStringTag } from "./syntax-tokens";

/** [light, dark] pairs. */
const palette = {
  keyword: ["#0000ff", "#569cd6"],
  comment: ["#006f00", "#6a9955"],
  string: ["#a31515", "#ce9178"],
  variable: ["#001188", "#74b0df"],
  number: ["#067347", "#b5cea8"],
  metatag: ["#cc0000", "#dd6a6f"],
  key: ["#863b00", "#9cdcfe"],
  tag: ["#800000", "#569cd6"],
  "attribute-name": ["#c40000", "#9cdcfe"],
  "html-string": ["#0000ff", "#ce9178"],
  "html-delimiter": ["#383838", "#8f8f8f"],
  "bracket-0": ["#0431fa", "#ffd700"],
  "bracket-1": ["#267326", "#da70d6"],
  "bracket-2": ["#7b3814", "#179fff"]
} as const;
type PaletteName = keyof typeof palette;

const syntaxColor = (name: PaletteName) => `var(--am-syntax-${name})`;

const variables = (scheme: 0 | 1) =>
  Object.fromEntries(
    Object.entries(palette).map(([name, pair]) => [
      `--am-syntax-${name}`,
      pair[scheme]
    ])
  );

/** The accent thinned over paper: strong enough to mark a range, weak enough that syntax colours stay readable on it. */
const accentTint = (percent: string) =>
  `color-mix(in srgb, var(--am-accent) ${percent}, var(--am-surface))`;
const accentRange = accentTint("40%");
const accentMatch = accentTint("30%");
const accentLine = accentTint("18%");

export const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: syntaxColor("keyword") },
  { tag: tags.comment, color: syntaxColor("comment") },
  { tag: tags.string, color: syntaxColor("string") },
  { tag: tags.variableName, color: syntaxColor("variable") },
  { tag: tags.number, color: syntaxColor("number") },
  { tag: tags.meta, color: syntaxColor("metatag") },
  { tag: tags.propertyName, color: syntaxColor("key") },
  { tag: tags.tagName, color: syntaxColor("tag") },
  { tag: tags.attributeName, color: syntaxColor("attribute-name") },
  { tag: htmlStringTag, color: syntaxColor("html-string") },
  { tag: htmlDelimiterTag, color: syntaxColor("html-delimiter") },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.invalid, color: "var(--am-problem)" },
  { tag: bracketTags[0], color: syntaxColor("bracket-0") },
  { tag: bracketTags[1], color: syntaxColor("bracket-1") },
  { tag: bracketTags[2], color: syntaxColor("bracket-2") }
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
  // Long-form source stays in the smooth monospace; the pixel face is for names and figures.
  ".cm-scroller": { fontFamily: "var(--font-code)", lineHeight: "20px" },
  ".cm-content": { padding: "0", caretColor: "var(--am-ink)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid var(--am-ink)" },
  ".cm-selectionBackground": { backgroundColor: "var(--am-selected)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: accentRange
  },
  ".cm-activeLine": { backgroundColor: "var(--am-wash)" },
  ".cm-selectionMatch": {
    backgroundColor: "transparent",
    outline: "1px dotted var(--am-ink-muted)"
  },
  ".cm-searchMatch": {
    backgroundColor: accentMatch,
    outline: "1px solid var(--am-ink)"
  },
  // Syntax hues drop under 4.5:1 on the match tint, so matched text is plain ink.
  ".cm-searchMatch, .cm-searchMatch *": { color: "var(--am-ink)" },
  // The current match is a full accent fill, so its text takes the accent's ink whatever its syntax colour.
  ".cm-searchMatch.cm-searchMatch-selected, .cm-searchMatch.cm-searchMatch-selected *":
    { backgroundColor: "var(--am-accent)", color: "var(--am-on-accent)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--am-wash)",
    outline: "1px solid var(--am-ink)"
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
  // Like Monaco, fold controls show while the pointer is over the gutter; a folded line keeps its control.
  ".cm-foldGutter .cm-gutterElement": {
    width: "26px",
    paddingLeft: "2px",
    color: "var(--am-ink-muted)"
  },
  ".cm-fold-marker": {
    display: "flex",
    height: "20px",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    opacity: "0"
  },
  ".cm-gutters:hover .cm-fold-marker, .cm-fold-marker[data-folded]": {
    opacity: "1"
  },
  ".cm-foldPlaceholder": {
    margin: "0 0.2em",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--am-ink-faint)"
  },
  // The find widget floats at the top right of a band kept clear above the first line.
  ".cm-panels": { backgroundColor: "transparent", color: "inherit" },
  ".cm-panels.cm-panels-top": { borderBottom: "none" },
  ".cm-tooltip": {
    backgroundColor: "var(--am-surface)",
    border: "2px solid var(--am-ink)",
    borderRadius: "0",
    color: "var(--am-ink)"
  },
  // No green and red: what was removed sits on wash with its changed text on gray, what was added on the accent.
  "&.cm-merge-a .cm-changedLine, .cm-deletedChunk": {
    backgroundColor: "var(--am-wash)"
  },
  "&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine": {
    backgroundColor: accentLine
  },
  "&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText":
    { background: "var(--am-selected)" },
  // Syntax hues drop under 4.5:1 on the strongest tint, so changed text is plain ink.
  "&.cm-merge-b .cm-changedText, &.cm-merge-b .cm-changedText *": {
    color: "var(--am-ink)"
  },
  "&.cm-merge-b .cm-changedText": { background: accentRange },
  ".cm-deletedChunk": { paddingLeft: "0" },
  // Changed lines carry − and + beside the line numbers instead of a colored bar.
  ".cm-changeGutter": { width: "14px", paddingLeft: "0" },
  ".cm-changeGutter .cm-gutterElement": {
    color: "var(--am-ink)",
    textAlign: "center"
  },
  "&.cm-merge-a .cm-changedLineGutter, .cm-deletedLineGutter, &.cm-merge-b .cm-changedLineGutter":
    { background: "none" },
  // The unified diff marks removed lines with its own gutter class.
  "&.cm-merge-a .cm-changedLineGutter::before, .cm-deletedLineGutter::before": {
    content: '"−"'
  },
  "&.cm-merge-b .cm-changedLineGutter::before": { content: '"+"' },
  // Where one side has no lines, a light dot fill holds the gap.
  ".cm-mergeSpacer": {
    backgroundColor: "var(--am-hairline)",
    mask: "var(--am-dots-light) 0 0 / 4px 4px"
  }
});
