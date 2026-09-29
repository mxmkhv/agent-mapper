import type { InventoryEntry, SourceDiagnostic } from "@agent-mapper/core";
import {
  isAlias,
  isMap,
  isScalar,
  parseDocument,
  type Document,
  type YAMLError
} from "yaml";

const openingLine = "---\n";
const closingLine = /^---[ \t]*$/m;
/** Frontmatter starts after the opening `---` on line 1. */
const headerLineOffset = 1;

type DocumentKind = InventoryEntry["kind"];

/** YAML messages quote source snippets, so diagnostics use fixed wording keyed by YAML error code. */
const yamlMessages = new Map([
  ["DUPLICATE_KEY", "Frontmatter repeats a key. Keep one of them."],
  ["BAD_INDENT", "Frontmatter indentation is inconsistent."],
  ["MISSING_CHAR", "Frontmatter is missing a closing quote or bracket."],
  ["MULTILINE_IMPLICIT_KEY", "A frontmatter key spans several lines."],
  ["UNEXPECTED_TOKEN", "Frontmatter contains unexpected YAML syntax."]
]);

function yamlDiagnostic(
  error: YAMLError,
  severity: SourceDiagnostic["severity"]
): SourceDiagnostic {
  const position = error.linePos?.[0];
  return {
    severity,
    code: `frontmatter-${error.code.toLowerCase().replaceAll("_", "-")}`,
    message:
      yamlMessages.get(error.code) ?? "Frontmatter YAML could not be parsed.",
    line: position ? position.line + headerLineOffset : undefined,
    column: position?.col
  };
}

function frontmatterBlock(
  content: string
): { header: string } | "unterminated" | undefined {
  if (!content.startsWith(openingLine)) {
    return undefined;
  }
  const rest = content.slice(openingLine.length);
  const end = closingLine.exec(rest);
  return end ? { header: rest.slice(0, end.index) } : "unterminated";
}

/**
 * Reads `name` and `description` from the parsed nodes instead of converting to JS, so an alias
 * (`*anchor`) is reported instead of throwing, and nothing is expanded.
 */
function skillFieldDiagnostics(document: Document): SourceDiagnostic[] {
  const diagnostics: SourceDiagnostic[] = [];
  for (const field of ["name", "description"]) {
    const node: unknown = document.get(field, true);
    if (!document.has(field)) {
      diagnostics.push({
        severity: "warning",
        code: `skill-${field}-missing`,
        message: `Skill frontmatter has no \`${field}\`. Claude Code and Codex use it to describe the skill.`
      });
    } else if (isAlias(node)) {
      diagnostics.push({
        severity: "warning",
        code: `skill-${field}-alias`,
        message: `Skill \`${field}\` uses a YAML alias, so agent-mapper cannot check that it is text.`
      });
    } else if (!isScalar(node) || typeof node.value !== "string") {
      diagnostics.push({
        severity: "error",
        code: `skill-${field}-type`,
        message: `Skill \`${field}\` must be text.`
      });
    }
  }
  return diagnostics;
}

/**
 * Checks only a leading YAML frontmatter block. For skills, YAML syntax, shape and non-text
 * `name`/`description` block a save; missing fields only warn. Instruction files are plain
 * Markdown to both tools, so every finding there is a warning. Line endings are normalized first,
 * matching what a save writes.
 */
export function validateDocument(
  content: string,
  kind: DocumentKind
): SourceDiagnostic[] {
  const severity = kind === "skill" ? "error" : "warning";
  const block = frontmatterBlock(content.replace(/\r\n?/g, "\n"));
  if (block === "unterminated") {
    return [
      {
        severity,
        code: "frontmatter-unterminated",
        message: "Frontmatter starts with `---` but has no closing `---` line.",
        line: 1
      }
    ];
  }
  if (!block) {
    return kind === "skill"
      ? [
          {
            severity: "warning",
            code: "skill-frontmatter-missing",
            message:
              "This skill has no frontmatter. Add `name` and `description` between `---` lines."
          }
        ]
      : [];
  }
  return frontmatterDiagnostics(block.header, kind);
}

function frontmatterDiagnostics(
  header: string,
  kind: DocumentKind
): SourceDiagnostic[] {
  const severity = kind === "skill" ? "error" : "warning";
  const document = parseDocument(header, { uniqueKeys: true });
  const problems = [
    ...document.errors.map((error) => yamlDiagnostic(error, severity)),
    ...document.warnings.map((warning) => yamlDiagnostic(warning, "warning"))
  ];
  if (document.errors.length) {
    return problems;
  }
  if (document.contents !== null && !isMap(document.contents)) {
    return [
      ...problems,
      {
        severity,
        code: "frontmatter-shape",
        message: "Frontmatter must be a set of `key: value` fields.",
        line: 2
      }
    ];
  }
  if (kind !== "skill") {
    return problems;
  }
  return [...problems, ...skillFieldDiagnostics(document)];
}

export function blockingDiagnostics(
  diagnostics: readonly SourceDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
