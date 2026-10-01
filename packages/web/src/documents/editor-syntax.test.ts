import { StringStream, type StreamParser } from "@codemirror/language";
import { expect, it } from "vitest";
import { iniParser } from "./ini-syntax";
import { markdownParser } from "./markdown-syntax";

/** Colored tokens per line as "token text", the way the editor would highlight them. */
function tokens<State>(parser: StreamParser<State>, text: string): string[][] {
  const state = parser.startState?.(2);
  if (state === undefined) {
    throw new Error("Parser has no start state");
  }
  return text.split("\n").map((line) => {
    if (!line) {
      parser.blankLine?.(state, 2);
      return [];
    }
    const stream = new StringStream(line, 4, 2);
    const colored: string[] = [];
    while (!stream.eol()) {
      const token = parser.token(stream, state);
      if (token) {
        colored.push(`${token} ${stream.current()}`);
      }
      stream.start = stream.pos;
    }
    return colored;
  });
}

it("colors Markdown structure the way Monaco did", () => {
  expect(
    tokens(
      markdownParser,
      [
        "# Global instructions",
        "Keep **simple** and _readable_. See [the docs](https://example.com).",
        "- Prefer `named exports`",
        "> Quote",
        "1. First"
      ].join("\n")
    )
  ).toEqual([
    ["keyword # Global instructions"],
    [
      "strong **simple**",
      "emphasis _readable_",
      "string [",
      "string ](https://example.com)"
    ],
    ["keyword - ", "variable `named exports`"],
    ["comment >"],
    ["keyword 1. "]
  ]);
});

it("colors unnamed code blocks but leaves named ones plain", () => {
  expect(
    tokens(markdownParser, "```\ncode\n```\n```ts\nconst a = (1);\n```")
  ).toEqual([
    ["string ```"],
    ["variable code"],
    ["string ```"],
    ["string ```ts"],
    [],
    []
  ]);
});

it("colors brackets in text by depth", () => {
  expect(tokens(markdownParser, "Call (a (b)) )")).toEqual([
    [
      "bracket0 (",
      "bracket1 (",
      "bracket1 )",
      "bracket0 )",
      "unexpectedBracket )"
    ]
  ]);
});

it("colors table pipes, dividers and header cells as keywords", () => {
  const [header, divider, body] = tokens(
    markdownParser,
    "| a | b |\n|---|---|\n| c | d |"
  );
  expect(header?.every((token) => token.startsWith("keyword"))).toBe(true);
  expect(divider).toEqual([
    "keyword |",
    "keyword ---",
    "keyword |",
    "keyword ---",
    "keyword |"
  ]);
  expect(body).toEqual(["keyword |", "keyword  |", "keyword  |"]);
});

it("colors INI sections, keys, values and line comments for TOML", () => {
  expect(
    tokens(
      iniParser,
      [
        "# Code reviewer",
        'name = "reviewer" # not a comment',
        "max_turns = 12",
        "[sandbox]",
        'paths = ["src", "tests"]'
      ].join("\n")
    )
  ).toEqual([
    ["comment # Code reviewer"],
    ["key name", 'string "reviewer"'],
    ["key max_turns", "number 12"],
    ["bracket0 [", "metatag sandbox", "bracket0 ]"],
    ["key paths", "bracket0 [", 'string "src"', 'string "tests"', "bracket0 ]"]
  ]);
});
