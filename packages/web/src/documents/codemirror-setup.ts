/**
 * Loaded only when an editor or diff (edit, review, conflict, history) is first shown. Keeps Monaco's behavior and syntax colors from
 * before the move to CodeMirror (see editor-theme.ts and the ported tokenizers). No workers, fonts or language services.
 */
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  syntaxHighlighting
} from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap
} from "@codemirror/search";
import {
  EditorState,
  type Extension,
  type StateEffect
} from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import type { EditorLanguage } from "./document-format";
import { languageSupport } from "./editor-languages";
import { editorTheme, highlightStyle } from "./editor-theme";
import { findPanel } from "./find-widget";

const svgNamespace = "http://www.w3.org/2000/svg";

/** Drawn on the same 11px grid as the app's pixel icons, one 1px square per step. */
const chevronDown =
  "M1 3h1v1h-1zM9 3h1v1h-1zM2 4h1v1h-1zM8 4h1v1h-1zM3 5h1v1h-1zM7 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM5 7h1v1h-1z";
const chevronRight =
  "M3 1h1v1h-1zM4 2h1v1h-1zM5 3h1v1h-1zM6 4h1v1h-1zM7 5h1v1h-1zM6 6h1v1h-1zM5 7h1v1h-1zM4 8h1v1h-1zM3 9h1v1h-1z";

/** Fold chevrons: down while open, right while folded. */
function foldMarker(open: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "cm-fold-marker";
  if (!open) {
    marker.dataset.folded = "";
  }
  const svg = document.createElementNS(svgNamespace, "svg");
  const attributes = {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    fill: "currentColor",
    "shape-rendering": "crispEdges"
  };
  for (const [name, value] of Object.entries(attributes)) {
    svg.setAttribute(name, value);
  }
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", open ? chevronDown : chevronRight);
  svg.append(path);
  marker.append(svg);
  return marker;
}

/** What every editor and diff side shares: language, theme, reading aids and keyboard navigation. */
export function baseExtensions(
  language: EditorLanguage,
  label: string
): Extension[] {
  return [
    lineNumbers(),
    highlightSpecialChars(),
    codeFolding({ placeholderText: "⋯" }),
    foldGutter({ markerDOM: foldMarker }),
    drawSelection(),
    highlightSelectionMatches(),
    search({ top: true, createPanel: findPanel }),
    bracketMatching(),
    syntaxHighlighting(highlightStyle),
    languageSupport(language),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ "aria-label": label }),
    editorTheme,
    keymap.of([...defaultKeymap, ...searchKeymap, ...foldKeymap])
  ];
}

/** Editing on top of the shared base: cursor line, undo history, multiple cursors and Tab indenting (Escape, then Tab, leaves the editor). */
export function editingExtensions(): Extension[] {
  return [
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    EditorState.allowMultipleSelections.of(true),
    rectangularSelection(),
    crosshairCursor(),
    keymap.of([...historyKeymap, indentWithTab])
  ];
}

export const readOnlyExtensions = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  // A non-editable view is not focusable by default; without focus, find and keyboard scrolling cannot reach it.
  EditorView.contentAttributes.of({ tabindex: "0", "aria-readonly": "true" })
];

interface DraftSession {
  state: EditorState;
  scroll: StateEffect<unknown>;
}

/** Text, undo history, selection and scroll per draft, kept while it has unsaved text so leaving and reopening the editor loses nothing. */
const sessions = new Map<string, DraftSession>();

export function draftSession(sourceKey: string): DraftSession | undefined {
  return sessions.get(sourceKey);
}

export function keepDraftSession(sourceKey: string, view: EditorView): void {
  sessions.set(sourceKey, {
    state: view.state,
    scroll: view.scrollSnapshot()
  });
}

export function dropDraftSession(sourceKey: string): void {
  sessions.delete(sourceKey);
}
