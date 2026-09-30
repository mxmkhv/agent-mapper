import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { errnoCode } from "./source-document-errors";

/** agent-mapper's own preferences. Agent configuration is never stored here. */
export interface AppConfig {
  /** Projects removed from the sidebar. Discovery skips listing them and git-scanning their folders. */
  hiddenProjects: string[];
}

const configVersion = 1;

/** ~/.config/agent-mapper/config.json on every platform, as the MVP brief specifies; an absolute XDG_CONFIG_HOME overrides ~/.config. */
export function defaultConfigPath(home: string): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return join(
    xdg && isAbsolute(xdg) ? xdg : join(home, ".config"),
    "agent-mapper",
    "config.json"
  );
}

function parseConfig(path: string, text: string): AppConfig {
  const fix = "Fix or delete it, then rescan.";
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${path} is not valid JSON. ${fix}`);
  }
  // Anything unexpected is refused rather than treated as empty, so the next save cannot overwrite it.
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object. ${fix}`);
  }
  const config = value as Record<string, unknown>;
  if (config.version !== undefined && config.version !== configVersion) {
    throw new Error(
      `${path} was written by a newer agent-mapper (version ${String(config.version)}). Update agent-mapper, or delete the file.`
    );
  }
  const hidden = config.hiddenProjects ?? [];
  if (
    !Array.isArray(hidden) ||
    hidden.some((item) => typeof item !== "string")
  ) {
    throw new Error(
      `${path} has an invalid hiddenProjects list; it must be an array of folder paths. ${fix}`
    );
  }
  return { hiddenProjects: hidden };
}

async function readConfig(path: string): Promise<AppConfig> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (errnoCode(error) === "ENOENT") {
      return { hiddenProjects: [] };
    }
    throw new Error(
      `Could not read ${path} (${errnoCode(error) ?? String(error)}). Check its permissions, then rescan.`,
      { cause: error }
    );
  }
  return parseConfig(path, text);
}

async function writeConfig(path: string, config: AppConfig): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      temporary,
      `${JSON.stringify({ version: configVersion, ...config }, null, 2)}\n`
    );
    await rename(temporary, path);
  } catch (error) {
    throw new Error(
      `Could not save ${path} (${errnoCode(error) ?? String(error)}). Check that the folder is writable, then try again.`,
      { cause: error }
    );
  }
}

function projectPath(value: string | undefined): string {
  if (!value || !isAbsolute(value)) {
    throw new Error("Send the project's absolute folder path.");
  }
  return resolve(value);
}

/** Serializes read-modify-write cycles so two quick removals cannot drop each other's change. */
export class ConfigStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly path: string) {}

  read(): Promise<AppConfig> {
    return readConfig(this.path);
  }

  setHidden(value: string | undefined, hidden: boolean): Promise<AppConfig> {
    const path = projectPath(value);
    const next = this.queue.then(async () => {
      const config = await readConfig(this.path);
      const others = config.hiddenProjects.filter((item) => item !== path);
      const updated = {
        ...config,
        hiddenProjects: hidden ? [...others, path].sort() : others
      };
      await writeConfig(this.path, updated);
      return updated;
    });
    // A failed write must not block later requests; the caller still sees this one's error.
    this.queue = next.catch(() => undefined);
    return next;
  }
}
