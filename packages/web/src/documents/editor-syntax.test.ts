import { StringStream, type StreamParser } from "@codemirror/language";
import { expect, it } from "vitest";
import { iniParser } from "./ini-syntax";
import { markdownParser } from "./markdown-syntax";

const stalledTokenLimit = 10;

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
    let stalled = 0;
    while (!stream.eol()) {
      const token = parser.token(stream, state);
      if (token && stream.pos > stream.start) {
        colored.push(`${token} ${stream.current()}`);
      }
      // CodeMirror gives up on a parser that does not advance after 10 tries; fail instead of looping forever.
      stalled = stream.pos > stream.start ? 0 : stalled + 1;
      if (stalled > stalledTokenLimit) {
        throw new Error(
          `Tokenizer stopped advancing at ${stream.pos} in "${line}"`
        );
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

it("keeps an escaped character out of the bracket after it", () => {
  expect(tokens(markdownParser, String.raw`a \[(b) c`)).toEqual([
    ["bracket0 (", "bracket0 )"]
  ]);
});

it("colors table pipes, dividers and header cells as keywords", () => {
  const [header, divider, body] = tokens(
    markdownParser,
    "| a | b |\n|---|---|\n| c | d |"
  );
  expect(header).toEqual([
    "keyword |",
    "keyword  a ",
    "keyword |",
    "keyword  b ",
    "keyword |"
  ]);
  expect(divider).toEqual([
    "keyword |",
    "keyword ---",
    "keyword |",
    "keyword ---",
    "keyword |"
  ]);
  expect(body).toEqual(["keyword |", "keyword  |", "keyword  |"]);
});

it("leaves the table at a blank line or a line without a pipe", () => {
  expect(tokens(markdownParser, "| a |\n\n# After")[2]).toEqual([
    "keyword # After"
  ]);
  expect(tokens(markdownParser, "| a |\n# After")[1]).toEqual([
    "keyword # After"
  ]);
});

it("colors inline HTML tags, attributes and comments across lines", () => {
  expect(
    tokens(markdownParser, `<div class="x" id='y'>\n<br />\n<!-- a\nb -->c`)
  ).toEqual([
    [
      "tag <div",
      "attributeName class",
      "htmlDelimiter =",
      'htmlString "x"',
      "attributeName id",
      "htmlDelimiter =",
      "htmlString 'y'",
      "tag >"
    ],
    ["tag <br", "tag />"],
    ["comment <!--", "comment  a"],
    ["comment b ", "comment -->"]
  ]);
});

it("keeps escapes, snake_case and bare ampersands plain", () => {
  expect(
    tokens(markdownParser, String.raw`\*not\* snake_case_name & &amp; [ref]`)
  ).toEqual([["string &amp;", "string [ref]"]]);
});

it("pairs the brackets of TOML array tables", () => {
  expect(tokens(iniParser, "[[hooks]]")).toEqual([
    ["bracket0 [", "bracket1 [", "metatag hooks", "bracket1 ]", "bracket0 ]"]
  ]);
});

it("keeps underscores inside a word out of emphasis", () => {
  expect(tokens(markdownParser, "foo_bar_ baz _real_")).toEqual([
    ["emphasis _real_"]
  ]);
});

it("always advances on awkward input", () => {
  for (const line of [
    "[]",
    "<",
    "\\",
    "&",
    "!",
    "`",
    "<!--",
    "|",
    "<a b=",
    "]"
  ]) {
    expect(() => tokens(markdownParser, line)).not.toThrow();
    expect(() => tokens(iniParser, line)).not.toThrow();
  }
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
