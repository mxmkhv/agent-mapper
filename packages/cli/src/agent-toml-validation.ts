import type { SourceDiagnostic } from "@agent-mapper/core";
import { parse, TomlError } from "smol-toml";

/** Codex reads a custom agent from these top-level keys; all three are required. */
const requiredFields = ["name", "description", "developer_instructions"];

/** The parser's message ends with a snippet of the file; only its first line names the problem. */
const firstLine = (message: string) => message.split("\n", 1)[0] ?? message;

/**
 * A Codex agent file must parse as TOML and keep its required keys as text: syntax and wrong types
 * block a save, a missing key only warns, since Codex is the one that refuses the agent.
 */
export function validateAgentToml(content: string): SourceDiagnostic[] {
  let document;
  try {
    document = parse(content);
  } catch (error) {
    if (!(error instanceof TomlError)) {
      throw error;
    }
    return [
      {
        severity: "error",
        code: "toml-syntax",
        message: `${firstLine(error.message)}.`,
        line: error.line,
        column: error.column
      }
    ];
  }
  const diagnostics: SourceDiagnostic[] = [];
  for (const field of requiredFields) {
    const value = document[field];
    if (value === undefined) {
      diagnostics.push({
        severity: "warning",
        code: `agent-${field}-missing`,
        message: `Agent has no \`${field}\`. Codex requires it to load the agent.`
      });
    } else if (typeof value !== "string") {
      diagnostics.push({
        severity: "error",
        code: `agent-${field}-type`,
        message: `Agent \`${field}\` must be text.`
      });
    }
  }
  return diagnostics;
}
