import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { SourceCollector } from "./source-reader";

export interface ManagedSettingsFile {
  path: string;
  data: Record<string, unknown>;
}

export function managedClaudeDirectory(options: {
  managedClaudeDir?: string;
}): string {
  if (options.managedClaudeDir) {
    return options.managedClaudeDir;
  }
  if (process.platform === "win32") {
    return join(process.env.ProgramFiles ?? "C:\\Program Files", "ClaudeCode");
  }
  return process.platform === "darwin"
    ? "/Library/Application Support/ClaudeCode"
    : "/etc/claude-code";
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

async function readSettings(
  path: string,
  errors: string[]
): Promise<ManagedSettingsFile | undefined> {
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
  return { path, data: settings as Record<string, unknown> };
}

export async function scanManagedClaude(
  collector: SourceCollector,
  directory: string
): Promise<ManagedSettingsFile[]> {
  await collector.add({
    tool: "claude",
    kind: "instruction",
    path: join(directory, "CLAUDE.md"),
    scope: "managed"
  });

  const files: ManagedSettingsFile[] = [];
  let selected: { path: string; content: string } | undefined;
  for (const path of await settingsPaths(directory, collector.errors)) {
    const file = await readSettings(path, collector.errors);
    if (!file) {
      continue;
    }
    files.push(file);
    if (!Object.hasOwn(file.data, "claudeMd")) {
      continue;
    }
    const value = file.data.claudeMd;
    if (typeof value !== "string") {
      collector.errors.push(`${path}: claudeMd must be a string.`);
      continue;
    }
    selected = { path, content: value };
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
  return files;
}
