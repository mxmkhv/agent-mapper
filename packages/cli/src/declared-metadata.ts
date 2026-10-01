import { isScalar, type Document } from "yaml";
import { inspectDocument } from "./source-document-validation";

function textName(document: Document): string | undefined {
  const node: unknown = document.get("name", true);
  return isScalar(node) && typeof node.value === "string"
    ? node.value.trim() || undefined
    : undefined;
}

/**
 * Strict YAML rejects common hand-written frontmatter, such as an unquoted colon in a description, while
 * the tools may still read it. A top-level `name:` line still names the source then.
 */
function lineName(header: string): string | undefined {
  const value = /^name:[ \t]*(.*?)[ \t]*$/m.exec(header)?.[1];
  return value?.replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;
}

export interface DeclaredMetadata {
  name?: string;
  /** Characters up to the end of the frontmatter block, the part a tool reads before selecting the source. */
  characters?: number;
  /** The first problem a save check reports, errors before warnings, with its line; a tool may refuse or misread it. */
  problem?: string;
}

/** A skill's or command's declared name, frontmatter size, and first problem, read as a save checks them. */
export function declaredMetadata(
  content: string,
  kind: "skill" | "command"
): DeclaredMetadata {
  const { diagnostics, block, document } = inspectDocument(content, kind);
  // A missing frontmatter block or description is only a warning to a save, but leaves a skill undescribed.
  const problem =
    diagnostics.find((diagnostic) => diagnostic.severity === "error") ??
    diagnostics[0];
  let name: string | undefined;
  if (document) {
    name = textName(document);
  } else if (block) {
    name = lineName(block.header);
  }
  return {
    name,
    characters: block?.end,
    problem:
      problem &&
      `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}`
  };
}
