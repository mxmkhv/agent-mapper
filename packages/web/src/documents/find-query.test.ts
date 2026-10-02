import { SearchQuery } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { expect, it } from "vitest";
import { matchCount } from "./find-query";

function count(
  doc: string,
  { search, selection }: { search: string; selection?: [number, number] }
) {
  const state = EditorState.create({
    doc,
    selection: selection && { anchor: selection[0], head: selection[1] }
  });
  return matchCount(state, new SearchQuery({ search }));
}

it("counts matches and names the selected one", () => {
  expect(
    count("step one step two", { search: "step", selection: [9, 13] })
  ).toBe("2 of 2");
  expect(count("step one step two", { search: "step" })).toBe("? of 2");
  expect(count("step one", { search: "missing" })).toBe("No results");
  expect(count("step one", { search: "" })).toBe("No results");
});

it("stops counting past 999 matches", () => {
  const doc = "x".repeat(1200);
  expect(count(doc, { search: "x", selection: [998, 999] })).toBe(
    "999 of 999+"
  );
  expect(count(doc, { search: "x", selection: [999, 1000] })).toBe("? of 999+");
  expect(count("x".repeat(999), { search: "x", selection: [0, 1] })).toBe(
    "1 of 999"
  );
});
