import type { StreamParser, StringStream } from "@codemirror/language";
import {
  bracket,
  firstMatch,
  tokenTable,
  type Brackets,
  type Rule,
  type Token
} from "./syntax-tokens";

type Block =
  | "text"
  | "code"
  | "embeddedCode"
  | "tableHeader"
  | "tableBody"
  | "htmlComment"
  | "htmlTag";

interface MarkdownState extends Brackets {
  block: Block;
  inLink: boolean;
  attribute: "none" | "equals" | "value";
}

// Monarch `@escapes`.
const escape = String.raw`\\[\\` + "`" + String.raw`*_{}\[\]()#+\-.!]`;
const backtick = "`";

/** Monarch `root`, in order: block structure recognized at the start of a line. */
const lineStartRules: readonly Rule<MarkdownState>[] = [
  { match: /^\s*\|/, token: "keyword", enter: { block: "tableHeader" } },
  {
    match: new RegExp(String.raw`^\s{0,3}#+(?:[^\\#]|${escape})+(?:#+)?`),
    token: "keyword"
  },
  { match: /^\s*(?:=+|-+)\s*$/, token: "keyword" },
  { match: /^\s*(?:\*[ ]?)+\s*$/, token: null },
  { match: /^\s*>+/, token: "comment" },
  { match: /^\s*(?:[*\-+:]|\d+\.)\s/, token: "keyword" },
  { match: /^(?:\t| {4})[^ ].*$/, token: "string" },
  {
    match: /^\s*~~~\s*(?:[\w/\-#]+)?\s*$/,
    token: "string",
    enter: { block: "code" }
  },
  // Monaco hands a named block to that language; unregistered ones render as plain text.
  {
    match: /^\s*```\s*[\w/\-#]+.*$/,
    token: "string",
    enter: { block: "embeddedCode" }
  },
  { match: /^\s*```\s*$/, token: "string", enter: { block: "code" } }
];

/** Monarch `linecontent` and `html`, in order: inline markup. */
const inlineRules: readonly Rule<MarkdownState>[] = [
  { match: /^&\w+;/, token: "string" },
  { match: new RegExp(`^${escape}`), token: null },
  {
    match: new RegExp(String.raw`^__(?:[^\\_]|${escape}|_(?!_))+__\b`),
    token: "strong"
  },
  {
    match: new RegExp(String.raw`^\*\*(?:[^\\*]|${escape}|\*(?!\*))+\*\*`),
    token: "strong"
  },
  { match: /^_[^_]+_\b/, token: "emphasis" },
  {
    match: new RegExp(String.raw`^\*(?:[^\\*]|${escape})+\*`),
    token: "emphasis"
  },
  {
    match: new RegExp(
      `^${backtick}(?:[^\\\\${backtick}]|${escape})+${backtick}`
    ),
    token: "variable"
  },
  { match: /^\{+[^}]+\}+/, token: "string" },
  // `[text](url)`: the brackets and URL are links, the text between them is plain.
  {
    match: new RegExp(String.raw`^!?\[(?=(?:[^\]\\]|${escape})*\]\([^)]+\))`),
    token: "string",
    enter: { inLink: true }
  },
  {
    match: new RegExp(String.raw`^!?\[(?:[^\]\\]|${escape})*\]`),
    token: "string"
  },
  { match: /^<\w+\/>/, token: "tag" },
  { match: /^<\w[\w-]*/, token: "tag", enter: { block: "htmlTag" } },
  { match: /^<\/\w[\w-]*\s*>/, token: "tag" },
  { match: "<!--", token: "comment", enter: { block: "htmlComment" } }
];

const linkText = new RegExp(String.raw`^(?:[^\]\\]|${escape})+`);

/** Monarch `tag`: attributes inside an opening HTML tag. */
const tagRules: readonly Rule<MarkdownState>[] = [
  { match: /^\s+/, token: null },
  {
    match: /^\w+(?=\s*=\s*(?:"[^"]*"|'[^']*'))/,
    token: "attributeName",
    enter: { attribute: "equals" }
  },
  { match: /^\w+/, token: "attributeName" },
  { match: "/>", token: "tag", enter: { block: "text" } },
  { match: ">", token: "tag", enter: { block: "text" } }
];

function inline(stream: StringStream, state: MarkdownState): Token {
  if (state.inLink) {
    if (stream.match(/^\]\([^)]+\)/)) {
      state.inLink = false;
      return "string";
    }
    stream.match(linkText);
    return null;
  }
  const token =
    firstMatch(stream, { state, rules: inlineRules }) ?? bracket(stream, state);
  if (token !== undefined) {
    return token;
  }
  // Plain text up to the next character a rule could start with; table cells also stop where a divider could start.
  const plain =
    state.block === "tableBody"
      ? /^[^\\&*_`{[\]!<()}|\s\-:]+/
      : /^[^\\&*_`{[\]!<()}]+/;
  if (!stream.match(plain)) {
    stream.next();
  }
  return null;
}

function htmlTag(stream: StringStream, state: MarkdownState): Token {
  if (state.attribute === "equals" && stream.match(/^\s*=\s*/)) {
    state.attribute = "value";
    return "htmlDelimiter";
  }
  if (state.attribute === "value" && stream.match(/^(?:"[^"]*"|'[^']*')/)) {
    state.attribute = "none";
    return "htmlString";
  }
  const token = firstMatch(stream, { state, rules: tagRules });
  if (token !== undefined) {
    return token;
  }
  stream.next();
  return null;
}

/** Monarch `table_header` and `table_body`: pipes and the divider row are keywords, header cells too. */
function table(stream: StringStream, state: MarkdownState): Token {
  if (stream.sol() && !stream.match(/^\s*\|/, false)) {
    state.block = "text";
    return text(stream, state);
  }
  if (stream.match(/^\s*[-:]+\s*/)) {
    state.block = "tableBody";
    return "keyword";
  }
  if (stream.match(/^\s*\|/)) {
    return "keyword";
  }
  if (state.block === "tableHeader") {
    stream.match(/^[^|]+/);
    return "keyword";
  }
  return inline(stream, state);
}

function text(stream: StringStream, state: MarkdownState): Token {
  const token = stream.sol()
    ? firstMatch(stream, { state, rules: lineStartRules })
    : undefined;
  return token === undefined ? inline(stream, state) : token;
}

const blocks: Record<
  Block,
  (stream: StringStream, state: MarkdownState) => Token
> = {
  text,
  tableHeader: table,
  tableBody: table,
  htmlTag,
  code: (stream, state) => {
    if (stream.sol() && stream.match(/^\s*(?:~~~|```)\s*$/)) {
      state.block = "text";
      return "string";
    }
    stream.skipToEnd();
    return "variable";
  },
  embeddedCode: (stream, state) => {
    if (stream.match(/^```\s*$/)) {
      state.block = "text";
    } else if (!stream.match(/^[^`]+/)) {
      stream.next();
    }
    return null;
  },
  htmlComment: (stream, state) => {
    if (stream.match("-->")) {
      state.block = "text";
    } else if (!stream.match(/^[^<-]+/)) {
      stream.next();
    }
    return "comment";
  }
};

/** Port of Monaco's `markdown` Monarch tokenizer. `^` rules apply only at the start of a line, as in Monarch. */
export const markdownParser: StreamParser<MarkdownState> = {
  name: "markdown",
  startState: () => ({
    block: "text",
    depth: 0,
    inLink: false,
    attribute: "none"
  }),
  token: (stream, state) => blocks[state.block](stream, state),
  blankLine: (state) => {
    if (state.block === "tableHeader" || state.block === "tableBody") {
      state.block = "text";
    }
    state.inLink = false;
  },
  languageData: { commentTokens: { block: { open: "<!--", close: "-->" } } },
  tokenTable
};
