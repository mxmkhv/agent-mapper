import type { StreamParser, StringStream } from "@codemirror/language";
import {
  bracket,
  tokenTable,
  type Brackets,
  type Token
} from "./syntax-tokens";

interface IniState extends Brackets {
  section: "none" | "name" | "close";
}

/** Port of Monaco's `ini` Monarch tokenizer: sections, keys, `#`/`;` comments, numbers and quoted strings. */
function iniToken(stream: StringStream, state: IniState): Token {
  if (state.section === "name") {
    stream.match(/^[^\]]*/);
    state.section = "close";
    return "metatag";
  }
  if (state.section === "close") {
    state.section = "none";
    return bracket(stream, state) ?? null;
  }
  if (stream.sol()) {
    // Monaco colors the brackets of a `[section]` as brackets and the name between them as a section.
    if (stream.match(/^\[(?=[^\]]*\])/, false)) {
      state.section = "name";
      return bracket(stream, state) ?? null;
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
