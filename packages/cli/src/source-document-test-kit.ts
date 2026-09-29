import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  DocumentError,
  InventorySnapshot,
  SourceDocument,
  SourceScope
} from "@agent-mapper/core";
import { vi } from "vitest";
import { createAppServer } from "./server";

/**
 * Isolated home with a global Claude instruction, a Codex instruction linked to it,
 * a project with its own instructions, a skill under a symlinked folder, a plugin skill
 * and a managed instruction. Nothing touches the real home folder.
 */
export function documentFixture() {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-mapper-doc-")));
  const project = join(home, "work", "app");
  const plugin = join(home, ".claude/plugins/cache/market/reviewer/1.0.0");
  const files = {
    ".claude/CLAUDE.md": "# Global\n\nBe brief.\n",
    "work/app/CLAUDE.md": "# App\n\nUse bun.\n",
    "work/app/AGENTS.md": "# Codex app\n",
    "shared/skills/writer/SKILL.md":
      "---\nname: writer\ndescription: Writes docs\n---\n\nWrite well.\n",
    ".claude/plugins/cache/market/reviewer/1.0.0/skills/review/SKILL.md":
      "---\nname: review\ndescription: Reviews\n---\n",
    "managed/CLAUDE.md": "# Managed\n"
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(home, path)), { recursive: true });
    writeFileSync(join(home, path), content);
  }
  mkdirSync(join(project, ".git"));
  mkdirSync(join(home, ".codex"));
  symlinkSync(join(home, ".claude/CLAUDE.md"), join(home, ".codex/AGENTS.md"));
  symlinkSync(join(home, "shared/skills"), join(home, ".claude/skills"));
  mkdirSync(join(plugin, ".claude-plugin"));
  writeFileSync(
    join(home, ".claude/plugins/installed_plugins.json"),
    JSON.stringify({
      version: 2,
      plugins: {
        "reviewer@market": [
          { scope: "user", installPath: plugin, version: "1.0.0" }
        ]
      }
    })
  );
  writeFileSync(
    join(home, ".claude/settings.json"),
    JSON.stringify({ enabledPlugins: { "reviewer@market": true } })
  );
  return { home, project, history: join(home, "history") };
}

export type DocumentFixture = ReturnType<typeof documentFixture>;

type Reply<T> = { status: number; body: T & { error?: DocumentError } };

function documentClient(base: string, headers: Record<string, string>) {
  async function scan(path?: string): Promise<InventorySnapshot> {
    const query = path ? `path=${encodeURIComponent(path)}` : "scope=global";
    const response = await fetch(`${base}/api/inventory?${query}`, {
      headers
    });
    return (await response.json()) as InventorySnapshot;
  }

  async function post<T>(
    route: string,
    body: Record<string, string>
  ): Promise<Reply<T>> {
    const response = await fetch(`${base}/api/source-document/${route}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return {
      status: response.status,
      body: (await response.json()) as Reply<T>["body"]
    };
  }

  /** Scans the context, then opens the entry whose path ends with `suffix`. */
  async function open(
    suffix: string,
    context: { scope: SourceScope; path?: string } = { scope: "global" }
  ): Promise<Reply<SourceDocument>> {
    const snapshot = await scan(context.path);
    const entry = snapshot.items.find(({ entry }) =>
      entry.path.endsWith(suffix)
    )?.entry;
    if (!entry) {
      throw new Error(`Fixture has no scanned entry ending with ${suffix}.`);
    }
    return post<SourceDocument>("open", {
      scope: context.scope,
      workingDirectory: snapshot.workingDirectory,
      entryId: entry.id
    });
  }

  return { base, headers, scan, post, open };
}

export async function startDocumentServer(fixture: DocumentFixture) {
  vi.stubEnv("CLAUDE_CONFIG_DIR", "");
  vi.stubEnv("CODEX_HOME", "");
  mkdirSync(join(fixture.home, "web"), { recursive: true });
  const app = createAppServer({
    home: fixture.home,
    codexHome: join(fixture.home, ".codex"),
    managedClaudeDir: join(fixture.home, "managed"),
    historyRoot: fixture.history,
    webRoot: join(fixture.home, "web")
  });
  const address = await app.listen();
  const client = documentClient(`http://127.0.0.1:${address.port}`, {
    authorization: `Bearer ${app.token}`
  });
  return {
    ...client,
    async close() {
      await app.close();
      vi.unstubAllEnvs();
    }
  };
}

export function removeFixture(fixture: DocumentFixture): void {
  rmSync(fixture.home, { recursive: true, force: true });
}
