import type { ToolId } from "@agent-mapper/core";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/** The parts of an agent both tools share: Claude Code keeps them in frontmatter and body, Codex in TOML keys. */
interface AgentParts {
  name?: string;
  description?: string;
  instructions: string;
  /** Settings only the source tool understands, which a conversion leaves behind. */
  toolOnly: string[];
}

export type Conversion =
  { content: string; dropped: string[] } | { problem: string };

const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;
const sharedFields = ["name", "description"];

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : undefined;

function isMap(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function markdownParts(content: string): AgentParts | undefined {
  const match = frontmatter.exec(content);
  if (!match) {
    return undefined;
  }
  let header: unknown;
  try {
    header = parseYaml(match[1] ?? "");
  } catch {
    return undefined;
  }
  if (!isMap(header)) {
    return undefined;
  }
  return {
    name: text(header.name),
    description: text(header.description),
    instructions: (match[2] ?? "").replace(/^(?:\r?\n)+/, ""),
    toolOnly: Object.keys(header).filter((key) => !sharedFields.includes(key))
  };
}

function tomlParts(content: string): AgentParts | undefined {
  let document;
  try {
    document = parseToml(content);
  } catch {
    return undefined;
  }
  return {
    name: text(document.name),
    description: text(document.description),
    instructions: text(document.developer_instructions) ?? "",
    toolOnly: Object.keys(document).filter(
      (key) => ![...sharedFields, "developer_instructions"].includes(key)
    )
  };
}

/** A multi-line TOML string keeps the instructions readable; it is used only if it parses back unchanged. */
function tomlInstructions(instructions: string): string {
  const escaped = instructions
    .replaceAll("\\", "\\\\")
    .replaceAll('"""', '""\\"');
  const block = `developer_instructions = """\n${escaped}"""\n`;
  try {
    if (parseToml(block).developer_instructions === instructions) {
      return block;
    }
  } catch {
    // Fall through to the escaped single-line form, which is always valid.
  }
  return stringifyToml({ developer_instructions: instructions });
}

function toToml(parts: AgentParts, fallbackName: string): string {
  const head = stringifyToml({
    name: parts.name ?? fallbackName,
    description: parts.description ?? ""
  });
  return `${head.trimEnd()}\n${tomlInstructions(parts.instructions)}`;
}

function toMarkdown(parts: AgentParts, fallbackName: string): string {
  const header = stringifyYaml(
    { name: parts.name ?? fallbackName, description: parts.description ?? "" },
    { lineWidth: 0 }
  );
  return `---\n${header}---\n\n${parts.instructions.trimEnd()}\n`;
}

/**
 * Rewrites an agent for the other tool. Name, description and instructions carry over; everything else
 * (Claude Code's `tools`, `model`, `color`; Codex's `model`, `sandbox_mode`, …) has no equivalent and is
 * reported as dropped rather than guessed at.
 */
export function convertAgent(input: {
  content: string;
  from: ToolId;
  /** The file name without its extension, used when the agent declares no name. */
  fallbackName: string;
}): Conversion {
  const parts =
    input.from === "claude"
      ? markdownParts(input.content)
      : tomlParts(input.content);
  if (!parts) {
    return {
      problem:
        input.from === "claude"
          ? "This agent's frontmatter could not be read, so it cannot be converted for Codex. Fix it in Edit first."
          : "This agent's TOML could not be parsed, so it cannot be converted for Claude Code. Fix it in Edit first."
    };
  }
  return {
    content:
      input.from === "claude"
        ? toToml(parts, input.fallbackName)
        : toMarkdown(parts, input.fallbackName),
    dropped: parts.toolOnly
  };
}
