import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createAppServer } from "./service";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const home = realpathSync(
    mkdtempSync(join(tmpdir(), "agent-mapper-projects-"))
  );
  roots.push(home);
  for (const name of ["alpha", "beta"]) {
    mkdirSync(join(home, name));
    writeFileSync(join(home, name, "CLAUDE.md"), `${name} instructions`);
  }
  mkdirSync(join(home, "web"));
  return { home, configPath: join(home, "config", "agent-mapper.json") };
}

async function withServer(
  options: ReturnType<typeof fixture>,
  run: (
    call: (path: string, init?: RequestInit) => Promise<Response>
  ) => Promise<void>
): Promise<void> {
  const app = createAppServer({
    ...options,
    webRoot: join(options.home, "web")
  });
  const address = await app.listen();
  const call = (path: string, init?: RequestInit) =>
    fetch(`http://127.0.0.1:${address.port}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${app.token}`,
        "content-type": "application/json"
      }
    });
  try {
    await run(call);
  } finally {
    await app.close();
  }
}

const post = (path: string) => ({
  method: "POST",
  body: JSON.stringify({ path })
});

it("removes a project from discovery and restores it", async () => {
  const options = fixture();
  const alpha = join(options.home, "alpha");
  await withServer(options, async (call) => {
    const names = async () => {
      const body = (await (await call("/api/projects")).json()) as {
        projects: { path: string }[];
        hidden: string[];
      };
      return [body.projects.map((project) => project.path), body.hidden];
    };
    expect(await names()).toEqual([[alpha, join(options.home, "beta")], []]);

    expect((await call("/api/projects/hide", post(alpha))).status).toBe(200);
    expect(await names()).toEqual([[join(options.home, "beta")], [alpha]]);
    expect(JSON.parse(readFileSync(options.configPath, "utf8"))).toEqual({
      version: 1,
      hiddenProjects: [alpha]
    });

    expect((await call("/api/projects/restore", post(alpha))).status).toBe(200);
    expect(await names()).toEqual([[alpha, join(options.home, "beta")], []]);
  });
});

it("rejects relative paths and explains a broken config file", async () => {
  const options = fixture();
  await withServer(options, async (call) => {
    const relative = await call("/api/projects/hide", post("alpha"));
    expect(relative.status).toBe(400);
    expect(await relative.json()).toEqual({
      error: "Send the project's absolute folder path."
    });

    mkdirSync(join(options.home, "config"));
    writeFileSync(options.configPath, "{ not json");
    const broken = await call("/api/projects");
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({
      error: `${options.configPath} is not valid JSON. Fix or delete it, then rescan.`
    });
  });
});

it("hides a main checkout together with its linked worktrees", async () => {
  const options = fixture();
  const main = join(options.home, "gamma");
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", main, ...args], { stdio: "ignore" });
  mkdirSync(main);
  writeFileSync(join(main, "CLAUDE.md"), "gamma instructions");
  git("init", "-b", "main");
  git("add", ".");
  git("-c", "user.name=T", "-c", "user.email=t@e.x", "commit", "-m", "init");
  git("worktree", "add", "-b", "feature", join(options.home, "gamma-feature"));
  await withServer(options, async (call) => {
    expect((await call("/api/projects/hide", post(main))).status).toBe(200);
    const body = (await (await call("/api/projects")).json()) as {
      projects: { path: string }[];
    };
    expect(body.projects.map((project) => project.path)).toEqual([
      join(options.home, "alpha"),
      join(options.home, "beta")
    ]);
  });
});
