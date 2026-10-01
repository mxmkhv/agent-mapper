import type { ToolId } from "@agent-mapper/core";

/**
 * SKILL.md fields and body syntax that Claude Code documents and Codex does not.
 * https://code.claude.com/docs/en/skills, https://learn.chatgpt.com/docs/build-skills
 */
const claudeOnlyFields = [
  "allowed-tools",
  "argument-hint",
  "context",
  "agent",
  "disable-model-invocation",
  "user-invocable",
  "hooks",
  "model",
  "paths",
  "when_to_use"
];

const claudeOnlySyntax: { pattern: RegExp; label: string }[] = [
  { pattern: /!`[^`]+`/, label: "!`command` context injection" },
  { pattern: /\$ARGUMENTS\b/, label: "$ARGUMENTS placeholders" },
  { pattern: /\$\{CLAUDE_[A-Z_]+\}/, label: "${CLAUDE_…} variables" }
];

function frontmatterFields(content: string): string[] {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return match?.[1]
    ? [...match[1].matchAll(/^([A-Za-z][\w-]*):/gm)].map(
        (field) => field[1] ?? ""
      )
    : [];
}

/** What another tool may read differently. Warnings only: the copy is still exact. */
export function skillPortability(input: {
  content: string;
  from: ToolId;
  to: readonly ToolId[];
  hasCodexMetadata: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.from === "claude" && input.to.includes("codex")) {
    const fields = frontmatterFields(input.content).filter((field) =>
      claudeOnlyFields.includes(field)
    );
    if (fields.length) {
      warnings.push(
        `Codex does not document these Claude Code fields, so it may ignore them: ${fields.join(", ")}.`
      );
    }
    const syntax = claudeOnlySyntax
      .filter(({ pattern }) => pattern.test(input.content))
      .map(({ label }) => label);
    if (syntax.length) {
      warnings.push(
        `Codex does not expand ${syntax.join(", ")}; it reads them as plain text.`
      );
    }
  }
  if (
    input.from === "codex" &&
    input.to.includes("claude") &&
    input.hasCodexMetadata
  ) {
    warnings.push(
      "Claude Code ignores agents/openai.yaml, so its display name, invocation policy and tool dependencies do not apply there."
    );
  }
  return warnings;
}
