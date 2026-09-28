import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { SourceCollector } from "./source-reader";

interface ManagedInstruction {
  path: string;
  content: string;
}

async function settingsPaths(
  directory: string,
  errors: string[]
): Promise<string[]> {
  const paths = [join(directory, "managed-settings.json")];
  const splitDirectory = join(directory, "managed-settings.d");
  try {
    const files = await readdir(splitDirectory, { withFileTypes: true });
    paths.push(
      ...files
        .filter(
          (file) =>
            !file.name.startsWith(".") &&
            file.name.endsWith(".json") &&
            (file.isFile() || file.isSymbolicLink())
        )
        .map((file) => join(splitDirectory, file.name))
        .sort()
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${splitDirectory}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return paths;
}

async function readInstruction(
  path: string,
  errors: string[]
): Promise<ManagedInstruction | undefined> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      errors.push(
        `${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return undefined;
  }
  let settings: unknown;
  try {
    settings = JSON.parse(content) as unknown;
  } catch {
    errors.push(`${path}: Managed settings JSON could not be parsed.`);
    return undefined;
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    errors.push(`${path}: Managed settings must be a JSON object.`);
    return undefined;
  }
  if (!Object.hasOwn(settings, "claudeMd")) {
    return undefined;
  }
  const value = (settings as Record<string, unknown>).claudeMd;
  if (typeof value !== "string") {
    errors.push(`${path}: claudeMd must be a string.`);
    return undefined;
  }
  return { path, content: value };
}

export async function scanManagedClaude(
  collector: SourceCollector,
  directory: string
): Promise<void> {
  await collector.add({
    tool: "claude",
    kind: "instruction",
    path: join(directory, "CLAUDE.md"),
    scope: "managed"
  });

  let selected: ManagedInstruction | undefined;
  for (const path of await settingsPaths(directory, collector.errors)) {
    selected = (await readInstruction(path, collector.errors)) ?? selected;
  }
  if (selected) {
    collector.addInline(
      {
        tool: "claude",
        kind: "instruction",
        path: selected.path,
        scope: "managed",
        name: "claudeMd",
        locator: "claudeMd"
      },
      selected.content
    );
  }
}
