import type { StringStream } from "@codemirror/language";
import { Tag, tags } from "@lezer/highlight";

/** Monaco's bracket pair colors cycle through three tags by nesting depth. */
export const bracketTags = [Tag.define(), Tag.define(), Tag.define()] as const;
export const htmlStringTag = Tag.define(tags.string);
export const htmlDelimiterTag = Tag.define(tags.punctuation);

/** Token names the ported Monarch tokenizers return, mapped to highlight tags. */
export const tokenTable = {
  keyword: tags.keyword,
  comment: tags.comment,
  string: tags.string,
  variable: tags.variableName,
  number: tags.number,
  strong: tags.strong,
  emphasis: tags.emphasis,
  metatag: tags.meta,
  key: tags.propertyName,
  tag: tags.tagName,
  attributeName: tags.attributeName,
  htmlString: htmlStringTag,
  htmlDelimiter: htmlDelimiterTag,
  bracket0: bracketTags[0],
  bracket1: bracketTags[1],
  bracket2: bracketTags[2],
  unexpectedBracket: tags.invalid
};
export type Token = keyof typeof tokenTable | null;

/** An ordered Monarch-style rule: the first match at the current position wins. */
export interface Rule<State> {
  match: RegExp | string;
  token: Token;
  /** State changes when the rule matches, like Monarch's `next`. */
  enter?: Partial<State>;
}

export function firstMatch<State extends object>(
  stream: StringStream,
  { state, rules }: { state: State; rules: readonly Rule<State>[] }
): Token | undefined {
  for (const rule of rules) {
    if (stream.match(rule.match)) {
      Object.assign(state, rule.enter);
      return rule.token;
    }
  }
  return undefined;
}

export interface Brackets {
  depth: number;
}

const depthTokens = ["bracket0", "bracket1", "bracket2"] as const;

/** Brackets outside strings and comments, colored by depth like Monaco's bracket pair colorization. */
export function bracket(
  stream: StringStream,
  state: Brackets
): Token | undefined {
  const char = stream.peek();
  if (char === undefined || !"()[]{}".includes(char)) {
    return undefined;
  }
  stream.next();
  if ("([{".includes(char)) {
    state.depth += 1;
    return depthTokens[(state.depth - 1) % depthTokens.length] ?? null;
  }
  if (state.depth === 0) {
    return "unexpectedBracket";
  }
  state.depth -= 1;
  return depthTokens[state.depth % depthTokens.length] ?? null;
}
