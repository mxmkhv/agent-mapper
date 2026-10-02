import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery
} from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import {
  runScopeHandlers,
  type EditorView,
  type Panel
} from "@codemirror/view";
import {
  ArrowDown,
  ArrowUp,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Regex,
  Replace,
  ReplaceAll,
  WholeWord,
  X
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  field,
  iconProps,
  input,
  OptionToggle,
  Row,
  ToolButton
} from "./find-widget-controls";
import { matchCount, selectNearest } from "./find-query";

interface FindWidgetProps {
  view: EditorView;
  state: EditorState;
}

/** Monaco's find widget: options inside the field, a match count, previous/next, and a replace row for editable text. */
function FindWidget({ view, state }: FindWidgetProps) {
  const [replacing, setReplacing] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const query = getSearchQuery(state);
  const editable = !state.readOnly;
  const showReplace = editable && replacing;

  function setQuery(
    change: Partial<ConstructorParameters<typeof SearchQuery>[0]>
  ) {
    const next = new SearchQuery({
      search: query.search,
      caseSensitive: query.caseSensitive,
      regexp: query.regexp,
      wholeWord: query.wholeWord,
      replace: query.replace,
      ...change
    });
    view.dispatch({ effects: setSearchQuery.of(next) });
    if (change.replace === undefined) {
      selectNearest(view, next);
    }
  }

  function keyDown(event: KeyboardEvent, enter: () => void) {
    // Escape, Cmd/Ctrl+G and Cmd/Ctrl+F act the same inside the widget as in the editor.
    if (runScopeHandlers(view, event.nativeEvent, "search-panel")) {
      event.preventDefault();
    } else if (event.key === "Enter") {
      event.preventDefault();
      enter();
    }
  }

  return (
    <div
      className={`absolute top-1 right-7 w-[419px] max-w-[calc(100%-36px)] bg-surface pr-1 pl-[9px] font-sans text-(--monaco-widget-foreground) ${showReplace ? "h-[62px]" : "h-[33px]"}`}
    >
      <div className="absolute inset-y-0 left-0 w-0.5 bg-hairline-strong" />
      {editable ? (
        <button
          aria-expanded={showReplace}
          aria-label="Toggle replace"
          className="absolute top-1 bottom-1 left-[5px] flex w-[18px] items-center justify-center rounded-[5px] hover:bg-(--monaco-toolbar-hover)"
          onClick={() => {
            // Opening the replace row puts the cursor in it, ready to type the replacement.
            flushSync(() => setReplacing(!replacing));
            replaceInput.current?.focus();
          }}
          title="Toggle replace"
          type="button"
        >
          {showReplace ? (
            <ChevronDown {...iconProps} />
          ) : (
            <ChevronRight {...iconProps} />
          )}
        </button>
      ) : null}
      <Row>
        <div className={field}>
          <input
            aria-label="Find"
            className={input}
            // @codemirror/search focuses and selects the `main-field` input when Cmd/Ctrl+F is pressed again.
            main-field="true"
            onChange={(event) => setQuery({ search: event.target.value })}
            onKeyDown={(event) =>
              keyDown(event, () =>
                event.shiftKey ? findPrevious(view) : findNext(view)
              )
            }
            placeholder="Find"
            spellCheck={false}
            value={query.search}
          />
          <OptionToggle
            active={query.caseSensitive}
            icon={CaseSensitive}
            label="Match case"
            onToggle={() => setQuery({ caseSensitive: !query.caseSensitive })}
          />
          <OptionToggle
            active={query.wholeWord}
            icon={WholeWord}
            label="Match whole word"
            onToggle={() => setQuery({ wholeWord: !query.wholeWord })}
          />
          <OptionToggle
            active={query.regexp}
            icon={Regex}
            label="Use regular expression"
            onToggle={() => setQuery({ regexp: !query.regexp })}
          />
          <span className="w-0.5 shrink-0" />
        </div>
        <span className="ml-[3px] w-[69px] shrink-0 pt-0.5 text-center text-[12px] leading-[23px]">
          {matchCount(state, query)}
        </span>
        <ToolButton
          disabled={!query.valid}
          icon={ArrowUp}
          label="Previous match"
          onClick={() => findPrevious(view)}
        />
        <ToolButton
          disabled={!query.valid}
          icon={ArrowDown}
          label="Next match"
          onClick={() => findNext(view)}
        />
        <ToolButton
          className="absolute top-[5px] right-0.5"
          icon={X}
          label="Close"
          onClick={() => {
            closeSearchPanel(view);
            view.focus();
          }}
        />
      </Row>
      {showReplace ? (
        <Row>
          <div className={field}>
            <input
              aria-label="Replace"
              ref={replaceInput}
              className={input}
              onChange={(event) => setQuery({ replace: event.target.value })}
              onKeyDown={(event) => keyDown(event, () => replaceNext(view))}
              placeholder="Replace"
              spellCheck={false}
              value={query.replace}
            />
          </div>
          <ToolButton
            disabled={!query.valid}
            icon={Replace}
            label="Replace"
            onClick={() => replaceNext(view)}
          />
          <ToolButton
            disabled={!query.valid}
            icon={ReplaceAll}
            label="Replace all"
            onClick={() => replaceAll(view)}
          />
        </Row>
      ) : null}
    </div>
  );
}

/** Renders the find widget as CodeMirror's search panel, in a band above the text like Monaco's. */
export function findPanel(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "relative h-[33px]";
  const root = createRoot(dom);
  // Synchronous first render, so the input exists when CodeMirror mounts the panel.
  flushSync(() => root.render(<FindWidget state={view.state} view={view} />));
  return {
    dom,
    top: true,
    // Monaco's widget opens with the search text selected, ready to type over.
    mount: () => dom.querySelector<HTMLInputElement>("[main-field]")?.select(),
    update: (update) =>
      root.render(<FindWidget state={update.state} view={view} />),
    // Unmount after the current render; the panel can be destroyed while React is committing an editor change.
    destroy: () => queueMicrotask(() => root.unmount())
  };
}
