import { useEffect, useEffectEvent, useRef } from "react";
import {
  applyTheme,
  disposeDraftModel,
  draftModel,
  monaco,
  restoreViewState,
  saveViewState
} from "./monaco-setup";

const sharedOptions = {
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  renderLineHighlight: "line",
  unicodeHighlight: { ambiguousCharacters: false }
} as const;

/** Follows <html data-theme>, including Auto flipping with the OS setting. */
function useEditorTheme(): void {
  useEffect(() => {
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);
}

interface SourceEditorProps {
  sourceKey: string;
  text: string;
  readOnly: boolean;
  /** Unsaved text exists; the model (and its undo history) is kept while it does. */
  dirty: boolean;
  label: string;
  onChange(text: string): void;
  onReview(): void;
}

/** Wraps Monaco directly. The draft's model outlives this view, so typing undo survives navigation. */
export function SourceEditor(props: SourceEditorProps) {
  const { sourceKey, text, readOnly, label } = props;
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor>(undefined);
  const change = useEffectEvent((value: string) => props.onChange(value));
  const review = useEffectEvent(() => props.onReview());
  const initialText = useEffectEvent(() => text);
  const keepModel = useEffectEvent(() => props.dirty);
  useEditorTheme();

  useEffect(() => {
    if (!host.current) {
      return;
    }
    const model = draftModel(sourceKey, initialText());
    const instance = monaco.editor.create(host.current, {
      ...sharedOptions,
      model,
      wordWrap: "on",
      ariaLabel: label
    });
    editor.current = instance;
    restoreViewState(sourceKey, instance);
    const subscription = model.onDidChangeContent(() =>
      change(model.getValue())
    );
    // Cmd/Ctrl+S opens review; it never saves directly.
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
      review()
    );
    instance.focus();
    return () => {
      saveViewState(sourceKey, instance);
      subscription.dispose();
      instance.dispose();
      editor.current = undefined;
      if (!keepModel()) {
        disposeDraftModel(sourceKey);
      }
    };
  }, [sourceKey, label]);

  useEffect(() => {
    editor.current?.updateOptions({ readOnly });
  }, [readOnly]);

  // Text changed outside the editor (discard, reload): bring the model in line.
  useEffect(() => {
    const model = editor.current?.getModel();
    if (model && model.getValue() !== text) {
      model.setValue(text);
    }
  }, [text]);

  return <div className="h-full min-h-64" ref={host} />;
}

export interface DiffStats {
  /** Lines touched, counting a replaced line once. */
  changed: number;
  added: number;
  removed: number;
}

const lineCount = (start: number, end: number) => (end ? end - start + 1 : 0);

function diffStats(changes: readonly monaco.editor.ILineChange[]): DiffStats {
  const stats = { changed: 0, added: 0, removed: 0 };
  for (const change of changes) {
    const added = lineCount(
      change.modifiedStartLineNumber,
      change.modifiedEndLineNumber
    );
    const removed = lineCount(
      change.originalStartLineNumber,
      change.originalEndLineNumber
    );
    stats.added += added;
    stats.removed += removed;
    stats.changed += Math.max(added, removed);
  }
  return stats;
}

interface SourceDiffProps {
  original: string;
  modified: string;
  label: string;
  onStats?(stats: DiffStats): void;
}

/** Read-only comparison; side by side when there is room, inline when narrow. */
export function SourceDiff({
  original,
  modified,
  label,
  ...props
}: SourceDiffProps) {
  const host = useRef<HTMLDivElement>(null);
  const reportStats = useEffectEvent((stats: DiffStats) =>
    props.onStats?.(stats)
  );
  useEditorTheme();

  useEffect(() => {
    if (!host.current) {
      return;
    }
    const originalModel = monaco.editor.createModel(original, "markdown");
    const modifiedModel = monaco.editor.createModel(modified, "markdown");
    const diff = monaco.editor.createDiffEditor(host.current, {
      ...sharedOptions,
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 760,
      diffWordWrap: "on",
      ariaLabel: label
    });
    diff.setModel({ original: originalModel, modified: modifiedModel });
    // The diff is computed asynchronously; the first result scrolls to the first change instead of line 1.
    let revealed = false;
    const updates = diff.onDidUpdateDiff(() => {
      if (!revealed) {
        revealed = true;
        diff.revealFirstDiff();
      }
      reportStats(diffStats(diff.getLineChanges() ?? []));
    });
    return () => {
      updates.dispose();
      diff.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [original, modified, label]);

  return <div className="h-full min-h-64" ref={host} />;
}
