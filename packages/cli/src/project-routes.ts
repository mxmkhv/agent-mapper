import type { IncomingMessage } from "node:http";
import { projectPath, type ConfigStore } from "./app-config";
import { discoverProjects, type DiscoveryResult } from "./discovery";
import { readJson } from "./source-actions";

export type ProjectsPayload = DiscoveryResult & { hidden: string[] };

interface ProjectRequest {
  request: IncomingMessage;
  url: URL;
  config: ConfigStore;
  home: string;
}

/** Route → whether the project ends up hidden. */
const projectVisibility = new Map([
  ["/api/projects/hide", true],
  ["/api/projects/restore", false]
]);

/** Project list and removal. Undefined when the route belongs elsewhere. */
export async function projectRoute({
  request,
  url,
  config,
  home
}: ProjectRequest): Promise<ProjectsPayload | { ok: true } | undefined> {
  if (request.method === "GET" && url.pathname === "/api/projects") {
    const { hiddenProjects } = await config.read();
    const discovery = await discoverProjects(home, {
      hidden: new Set(hiddenProjects)
    });
    return { ...discovery, hidden: hiddenProjects };
  }
  const hidden = projectVisibility.get(url.pathname);
  if (request.method !== "POST" || hidden === undefined) {
    return undefined;
  }
  const body = await readJson(request);
  await config.setHidden(projectPath(body.path), hidden);
  return { ok: true };
}
