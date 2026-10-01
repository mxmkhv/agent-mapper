import {
  getChunks,
  getOriginalDoc,
  MergeView,
  unifiedMergeView
} from "@codemirror/merge";
import { closeSearchPanel } from "@codemirror/search";
import { Compartment, EditorState, Prec, StateEffect } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject
} from "react";
import {
  baseExtensions,
  draftSession,
  dropDraftSession,
  editingExtensions,
  keepDraftSession,
  readOnlyExtensions
} from "./codemirror-setup";
import { diffConfig, diffStats, type DiffStats } from "./diff-stats";
import type { EditorLanguage } from "./document-format";

interface SourceEditorProps {
  sourceKey: string;
  text: string;
  language: EditorLanguage;
  readOnly: boolean;
  /** Unsaved text exists; the editor state (and its undo history) is kept while it does. */
  dirty: boolean;
  label: string;
  onChange(text: string): void;
  onReview(): void;
}

/** Wraps CodeMirror directly. A dirty draft's state outlives this view, so typing undo survives navigation. */
export function SourceEditor(props: SourceEditorProps) {
  const { sourceKey, text, language, readOnly, label } = props;
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{ view: EditorView; reset(text: string): void }>(
    undefined
  );
  const editable = useRef(new Compartment());
  const change = useEffectEvent((value: string) => props.onChange(value));
  const review = useEffectEvent(() => props.onReview());
  const initialText = useEffectEvent(() => text);
  const isReadOnly = useEffectEvent(() => readOnly);
  const keepSession = useEffectEvent(() => props.dirty);

  // A layout effect: its cleanup runs while the editor is still on the page, so the saved scroll position is real.
  useLayoutEffect(() => {
    if (!host.current) {
      return;
    }
    const extensions = () => [
      baseExtensions(language, label),
      editingExtensions(),
      editable.current.of(isReadOnly() ? readOnlyExtensions : []),
      // Cmd/Ctrl+S opens review; it never saves directly.
      Prec.highest(
        keymap.of([
          {
            key: "Mod-s",
            // Also from the find widget, which sits inside the editor as Monaco's did.
            scope: "editor search-panel",
            run: () => {
              review();
              return true;
            }
          }
        ])
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          change(update.state.doc.toString());
        }
      })
    ];
    const session = draftSession(sourceKey);
    const view = new EditorView({
      parent: host.current,
      state: session
        ? // Fresh extensions bind this mount's callbacks; history and selection carry over.
          session.state.update({
            effects: StateEffect.reconfigure.of(extensions())
          }).state
        : EditorState.create({ doc: initialText(), extensions: extensions() }),
      scrollTo: session?.scroll
    });
    editor.current = {
      view,
      // A new state also clears undo, so discarded edits cannot come back.
      reset: (value) =>
        view.setState(
          EditorState.create({ doc: value, extensions: extensions() })
        )
    };
    view.focus();
    return () => {
      if (keepSession()) {
        // Like Monaco, find does not stay open across visits; restoring it would also mount its widget mid-render.
        closeSearchPanel(view);
        keepDraftSession(sourceKey, view);
      } else {
        dropDraftSession(sourceKey);
      }
      view.destroy();
      editor.current = undefined;
    };
  }, [sourceKey, language, label]);

  useEffect(() => {
    editor.current?.view.dispatch({
      effects: editable.current.reconfigure(readOnly ? readOnlyExtensions : [])
    });
  }, [readOnly]);

  // Text changed outside the editor (discard, reload): bring the editor in line.
  useEffect(() => {
    if (editor.current && editor.current.view.state.doc.toString() !== text) {
      editor.current.reset(text);
    }
  }, [text]);

  return <div className="h-full min-h-64" ref={host} />;
}

/** Below this width the diff shows one column with removed lines above added ones. */
const sideBySideMinWidth = 760;

/** Undefined until the host is measured, so the diff is built once at the right layout. */
function useNarrow(host: RefObject<HTMLElement | null>): boolean | undefined {
  const [narrow, setNarrow] = useState<boolean>();
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const measure = () => setNarrow(element.clientWidth < sideBySideMinWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return narrow;
}

interface SourceDiffProps {
  original: string;
  modified: string;
  language: EditorLanguage;
  label: string;
  /** Undefined when the diff ran past its time budget and fell back to coarser chunks. */
  onStats?(stats: DiffStats | undefined): void;
}

/** Read-only comparison; side by side when there is room, inline when narrow. */
export function SourceDiff({
  original,
  modified,
  language,
  label,
  ...props
}: SourceDiffProps) {
  const host = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(host);
  const reportStats = useEffectEvent((stats: DiffStats | undefined) =>
    props.onStats?.(stats)
  );

  useEffect(() => {
    if (!host.current || narrow === undefined) {
      return;
    }
    if (narrow) {
      const view = new EditorView({
        parent: host.current,
        doc: modified,
        extensions: [
          baseExtensions(language, label),
          readOnlyExtensions,
          unifiedMergeView({ original, mergeControls: false, diffConfig })
        ]
      });
      const chunks = getChunks(view.state)?.chunks ?? [];
      reportStats(
        diffStats({
          chunks,
          original: getOriginalDoc(view.state),
          modified: view.state.doc
        })
      );
      revealFirstChange(view, chunks[0]?.fromB);
      return () => view.destroy();
    }
    const side = (name: string) => [
      baseExtensions(language, `${label}: ${name}`),
      readOnlyExtensions
    ];
    const merge = new MergeView({
      parent: host.current,
      a: { doc: original, extensions: side("left side") },
      b: { doc: modified, extensions: side("right side") },
      gutter: true,
      diffConfig
    });
    reportStats(
      diffStats({
        chunks: merge.chunks,
        original: merge.a.state.doc,
        modified: merge.b.state.doc
      })
    );
    revealFirstChange(merge.b, merge.chunks[0]?.fromB);
    return () => merge.destroy();
  }, [original, modified, language, label, narrow]);

  return (
    <div
      className="h-full min-h-64 [&_.cm-mergeView]:h-full [&_.cm-mergeView]:overflow-auto [&_.cm-mergeViewEditor+.cm-mergeViewEditor]:border-l [&_.cm-mergeViewEditor+.cm-mergeViewEditor]:border-hairline-strong [&_.cm-mergeViewEditors]:min-h-full"
      ref={host}
    />
  );
}

/** Opens a diff at its first change instead of line 1. */
function revealFirstChange(view: EditorView, position: number | undefined) {
  if (position !== undefined) {
    view.dispatch({
      effects: EditorView.scrollIntoView(position, { y: "center" })
    });
  }
}
