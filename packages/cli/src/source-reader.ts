import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { InventoryEntry } from "@agent-mapper/core";
import {
  candidateKey,
  entryIdFor,
  lineCount,
  makeEntry,
  readSource,
  type Candidate,
  type SourceRead
} from "./source-entry";

export class SourceCollector {
  readonly entries: InventoryEntry[] = [];
  readonly errors: string[] = [];
  private readonly seen = new Set<string>();
  private readonly sources = new Map<string, Promise<SourceRead | undefined>>();
  private readonly contents = new Map<string, string>();

  content(path: string): string | undefined {
    return this.contents.get(path);
  }

  async add(candidate: Candidate): Promise<void> {
    const key = candidateKey(candidate);
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    let pending = this.sources.get(candidate.path);
    if (!pending) {
      pending = readSource(candidate.path);
      this.sources.set(candidate.path, pending);
    }
    const source = await pending;
    if (!source) {
      return;
    }
    if (source.state === "readable") {
      this.contents.set(candidate.path, source.content);
    }
    if (source.error) {
      this.errors.push(`${candidate.path}: ${source.error}`);
    }
    this.entries.push(makeEntry({ candidate, source, key }));
  }

  addInline(candidate: Candidate, content: string): void {
    const key = candidateKey(candidate);
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    this.entries.push({
      id: entryIdFor(key),
      tool: candidate.tool,
      kind: candidate.kind,
      name: candidate.name ?? basename(candidate.path),
      path: candidate.path,
      scope: candidate.scope,
      readState: "readable",
      isSymlink: false,
      locator: candidate.locator,
      inlineContent: true,
      characters: content.length,
      lineCount: lineCount(content)
    });
  }

  async addSkills(
    candidate: Omit<Candidate, "path" | "kind"> & { directory: string }
  ): Promise<void> {
    let children;
    try {
      children = await readdir(candidate.directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.errors.push(
          `${candidate.directory}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return;
    }
    for (const child of children) {
      const childPath = join(candidate.directory, child.name);
      let directory = child.isDirectory();
      if (child.isSymbolicLink()) {
        try {
          directory = (await stat(childPath)).isDirectory();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            await this.add({
              ...candidate,
              kind: "skill",
              path: childPath,
              name: child.name
            });
          } else {
            this.errors.push(
              `${childPath}: Could not inspect skill link. Check permissions.`
            );
          }
        }
      }
      if (directory) {
        await this.add({
          ...candidate,
          kind: "skill",
          path: join(childPath, "SKILL.md")
        });
      }
    }
  }

  async addCommands(
    candidate: Omit<Candidate, "path" | "kind" | "name"> & {
      directory: string;
    }
  ): Promise<void> {
    const pending = [candidate.directory];
    while (pending.length) {
      const directory = pending.pop()!;
      let children;
      try {
        children = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.errors.push(
            `${directory}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        continue;
      }
      for (const child of children) {
        const path = join(directory, child.name);
        if (child.isDirectory()) {
          pending.push(path);
        } else if (
          child.name.endsWith(".md") &&
          (child.isFile() || child.isSymbolicLink())
        ) {
          await this.add({
            ...candidate,
            kind: "command",
            path,
            name: relative(candidate.directory, path)
              .slice(0, -".md".length)
              .split(sep)
              .join(":")
          });
        }
      }
    }
  }
}
