import {
  foldService,
  LanguageSupport,
  StreamLanguage
} from "@codemirror/language";
import type { EditorLanguage } from "./document-format";
import { iniParser } from "./ini-syntax";
import { markdownParser } from "./markdown-syntax";

/** Leading whitespace width, or undefined for a blank line. */
function indentation(text: string): number | undefined {
  const leading = /^\s*/.exec(text)?.[0] ?? "";
  return leading.length === text.length ? undefined : leading.length;
}

/**
 * Monaco folded both languages by indentation: a line folds the deeper-indented lines below it. Simplified here: Monaco
 * also folded Markdown `<!-- #region -->` markers and kept trailing blank lines inside a fold.
 */
const indentationFolding = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const indent = indentation(line.text);
  if (indent === undefined) {
    return null;
  }
  let end = line;
  for (let number = line.number + 1; number <= state.doc.lines; number += 1) {
    const next = state.doc.line(number);
    const nextIndent = indentation(next.text);
    if (nextIndent !== undefined && nextIndent <= indent) {
      break;
    }
    if (nextIndent !== undefined) {
      end = next;
    }
  }
  return end.number > line.number ? { from: line.to, to: end.to } : null;
});

const markdown = new LanguageSupport(StreamLanguage.define(markdownParser), [
  indentationFolding
]);
// Monaco ships no TOML tokenizer, so TOML used INI, which colors its keys, strings, tables and `#` comments well enough.
// Multi-line strings and inline tables are where it falls short.
const ini = new LanguageSupport(StreamLanguage.define(iniParser), [
  indentationFolding
]);

export function languageSupport(language: EditorLanguage): LanguageSupport {
  return language === "toml" ? ini : markdown;
}
