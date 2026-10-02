import { SearchQuery } from "@codemirror/search";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Counting stops past this many matches to keep the label short. Monaco capped its count too, at 19,999. */
const countLimit = 999;

export function matchCount(state: EditorState, query: SearchQuery): string {
  if (!query.valid) {
    return "No results";
  }
  const { from, to } = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current = 0;
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    total += 1;
    if (total > countLimit) {
      return `${current || "?"} of ${countLimit}+`;
    }
    if (next.value.from === from && next.value.to === to) {
      current = total;
    }
  }
  return total ? `${current || "?"} of ${total}` : "No results";
}

/** Find as you type: select the first match at or after the cursor, wrapping to the top. */
export function selectNearest(view: EditorView, query: SearchQuery): void {
  if (!query.valid) {
    return;
  }
  const start = view.state.selection.main.from;
  let match = query.getCursor(view.state, start).next();
  if (match.done) {
    match = query.getCursor(view.state).next();
  }
  if (!match.done) {
    view.dispatch({
      selection: { anchor: match.value.from, head: match.value.to },
      effects: EditorView.scrollIntoView(match.value.from, { y: "nearest" })
    });
  }
}
