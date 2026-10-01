import type { StreamParser, StringStream } from "@codemirror/language";
import {
  bracket,
  tokenTable,
  type Brackets,
  type Token
} from "./syntax-tokens";

interface IniState extends Brackets {
  section: "none" | "open" | "name" | "close";
}

/**
 * Port of Monaco's `ini` Monarch tokenizer: sections, keys, `#`/`;` comments, numbers and quoted strings.
 * Two deliberate differences: TOML's `[[array]]` tables pair all four brackets, and indented comments are colored too.
 */
function iniToken(stream: StringStream, state: IniState): Token {
  const section = iniSection(stream, state);
  if (section !== undefined) {
    return section;
  }
  if (stream.sol()) {
    // Monaco colors the brackets of a `[section]` as brackets and the name between them as a section.
    if (stream.match(/^\[\[?[^\]]*\]/, false)) {
      state.section = "open";
      return iniSection(stream, state) ?? null;
    }
    if (stream.match(/^\w+(?=\s*=)/)) {
      return "key";
    }
    if (stream.match(/^\s*[#;].*$/)) {
      return "comment";
    }
  }
  return iniValue(stream, state);
}

/** Steps through `[name]` or `[[name]]`: opening brackets, the name, closing brackets. */
function iniSection(stream: StringStream, state: IniState): Token | undefined {
  if (state.section === "open") {
    const token = bracket(stream, state) ?? null;
    if (stream.peek() !== "[") {
      state.section = "name";
    }
    return token;
  }
  if (state.section === "name") {
    state.section = "close";
    if (stream.match(/^[^\]]+/)) {
      return "metatag";
    }
  }
  if (state.section === "close") {
    if (stream.peek() === "]") {
      return bracket(stream, state) ?? null;
    }
    state.section = "none";
  }
  return undefined;
}

function iniValue(stream: StringStream, state: IniState): Token {
  if (stream.eatSpace()) {
    return null;
  }
  if (stream.match(/^\d+/)) {
    return "number";
  }
  // Strings never span lines: an unterminated one ends at the line end.
  if (
    stream.match(/^"(?:[^"\\]|\\.)*"?/) ||
    stream.match(/^'(?:[^'\\]|\\.)*'?/)
  ) {
    return "string";
  }
  const brace = bracket(stream, state);
  if (brace !== undefined) {
    return brace;
  }
  if (!stream.match(/^[^\s\d"'()[\]{}]+/)) {
    stream.next();
  }
  return null;
}

export const iniParser: StreamParser<IniState> = {
  name: "ini",
  startState: () => ({ depth: 0, section: "none" }),
  token: iniToken,
  languageData: { commentTokens: { line: "#" } },
  tokenTable
};
