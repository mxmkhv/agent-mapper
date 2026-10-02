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
import { useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PixelIcon } from "../ui/pixel-icon";
import {
  field,
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

/** Laid out like Monaco's find widget: options inside the field, a match count, previous/next, and a replace row for editable text. */
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
      className={`absolute top-1 right-7 w-[430px] max-w-[calc(100%-36px)] border-2 border-ink bg-surface pr-1 pl-[9px] font-sans text-ink ${showReplace ? "h-[66px]" : "h-[37px]"}`}
    >
      {editable ? (
        <button
          aria-expanded={showReplace}
          aria-label="Toggle replace"
          className="absolute top-1 bottom-1 left-[5px] flex w-[18px] items-center justify-center hover:bg-wash"
          onClick={() => {
            // Opening the replace row puts the cursor in it, ready to type the replacement.
            flushSync(() => setReplacing(!replacing));
            replaceInput.current?.focus();
          }}
          title="Toggle replace"
          type="button"
        >
          <PixelIcon name={showReplace ? "chevron-down" : "chevron-right"} />
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
            icon="find-case"
            label="Match case"
            onToggle={() => setQuery({ caseSensitive: !query.caseSensitive })}
          />
          <OptionToggle
            active={query.wholeWord}
            icon="find-word"
            label="Match whole word"
            onToggle={() => setQuery({ wholeWord: !query.wholeWord })}
          />
          <OptionToggle
            active={query.regexp}
            icon="find-regex"
            label="Use regular expression"
            onToggle={() => setQuery({ regexp: !query.regexp })}
          />
          <span className="w-0.5 shrink-0" />
        </div>
        <span className="ml-[3px] w-[76px] shrink-0 text-center font-mono text-mono">
          {matchCount(state, query)}
        </span>
        <ToolButton
          disabled={!query.valid}
          icon="arrow-up"
          label="Previous match"
          onClick={() => findPrevious(view)}
        />
        <ToolButton
          disabled={!query.valid}
          icon="arrow-down"
          label="Next match"
          onClick={() => findNext(view)}
        />
        <ToolButton
          className="absolute top-[5px] right-0.5"
          icon="close"
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
            icon="find-replace"
            label="Replace"
            onClick={() => replaceNext(view)}
          />
          <ToolButton
            disabled={!query.valid}
            icon="find-replace-all"
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
  dom.className = "relative h-[41px]";
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
