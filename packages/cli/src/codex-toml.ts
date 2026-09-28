import { readFile } from "node:fs/promises";
import { parse } from "smol-toml";
import { object, type JsonMap } from "./plugin-reader-common";

export class CodexTomlReader {
  readonly errors: string[] = [];
  private readonly cache = new Map<string, Promise<JsonMap | undefined>>();

  read(path: string): Promise<JsonMap | undefined> {
    let pending = this.cache.get(path);
    if (!pending) {
      pending = this.load(path);
      this.cache.set(path, pending);
    }
    return pending;
  }

  private async load(path: string): Promise<JsonMap | undefined> {
    let content: string;
    try {
      content = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.errors.push(
          `${path}: Could not read Codex TOML settings. Check permissions.`
        );
      }
      return undefined;
    }
    try {
      return object(parse(content, { unsafeKeyBehaviour: "throw" }));
    } catch {
      this.errors.push(
        `${path}: Could not parse Codex TOML settings. Fix the syntax and rescan.`
      );
      return undefined;
    }
  }
}
