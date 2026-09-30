import type { PathContext } from "./paths";
import type { InventoryRecord } from "./record-types";

const stem = (file: string) => file.replace(/\.[^.]+$/, "");

/** Folders a tool reads instruction files from by default: its root under home, or the project root. */
function isToolRoot(directory: string, context: PathContext): boolean {
  return (
    directory === context.projectRoot ||
    (context.home !== undefined &&
      [`${context.home}/.claude`, `${context.home}/.codex`].includes(directory))
  );
}

/**
 * The path says nothing the row does not: `skills/<name>/SKILL.md`, `agents/<name>.md`, `commands/<name>.md`,
 * or an instruction file at a tool or project root. A name that differs from its folder keeps its path.
 */
export function isConventionalPath(
  record: InventoryRecord,
  context: PathContext
): boolean {
  // Nearest segments first: the file, its folder, then that folder's parent.
  const [file = "", folder, parent] = record.path.split("/").reverse();
  switch (record.kind) {
    case "skill":
      return (
        file === "SKILL.md" && folder === record.name && parent === "skills"
      );
    case "agent":
    case "command":
      return stem(file) === record.name && folder === `${record.kind}s`;
    case "instruction":
      return (
        file === record.name &&
        isToolRoot(record.path.slice(0, -file.length - 1), context)
      );
    default:
      return false;
  }
}
