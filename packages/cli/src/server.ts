import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import type { InventorySnapshot, PullRequestLookup } from "@agent-mapper/core";
import { ConfigStore, defaultConfigPath } from "./app-config";
import { projectRoute, type ProjectsPayload } from "./project-routes";
import { buildGlobalSnapshot, buildSnapshot } from "./service";
import { serveAsset } from "./server-assets";
import {
  createServices,
  rememberProjects,
  type ServerServices
} from "./server-services";
import { worktreeRoute } from "./worktree-routes";
import type { MoveToTrash } from "./source-delete";
import { handleItemRoute } from "./source-delete-routes";
import { handleDocumentRoute, isDocumentRoute } from "./source-document-routes";
import {
  launchOpen,
  performSourceAction,
  sourcePathIndex
} from "./source-actions";

export interface AppServerOptions {
  home?: string;
  codexHome?: string;
  webRoot: string;
  managedClaudeDir?: string;
  /** Private revision snapshots; defaults to the platform data folder. */
  historyRoot?: string;
  /** agent-mapper preferences such as removed projects; defaults to ~/.config/agent-mapper/config.json (XDG_CONFIG_HOME aware). */
  configPath?: string;
  launchSource?: (args: string[]) => Promise<void>;
  /** Moves deleted skills and agents away; defaults to the macOS Trash. */
  trash?: MoveToTrash;
}
export interface AppServer {
  token: string;
  listen(): Promise<AddressInfo>;
  close(): Promise<void>;
}

interface RequestContext extends ServerServices {
  request: IncomingMessage;
  response: ServerResponse;
  server: Server;
  token: string;
  options: AppServerOptions;
  config: ConfigStore;
}

type ApiPayload =
  | ProjectsPayload
  | InventorySnapshot
  | PullRequestLookup
  | { error: string }
  | { ok: true };
interface JsonReply {
  response: ServerResponse;
  status: number;
  payload: ApiPayload;
}

const status = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  missing: 404
} as const;
const tokenBytes = 32;

function sendJson(reply: JsonReply): void {
  reply.response.writeHead(reply.status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  reply.response.end(JSON.stringify(reply.payload));
}

async function inventoryPayload(
  context: RequestContext,
  url: URL
): Promise<InventorySnapshot> {
  const path = url.searchParams.get("path");
  const scanOptions = {
    home: context.options.home,
    codexHome: context.options.codexHome,
    managedClaudeDir: context.options.managedClaudeDir
  };
  if (!path && url.searchParams.get("scope") !== "global") {
    throw new Error("Choose a folder to scan.");
  }
  const payload =
    url.searchParams.get("scope") === "global"
      ? await buildGlobalSnapshot(scanOptions)
      : await buildSnapshot(path ?? "", scanOptions);
  const scope =
    url.searchParams.get("scope") === "global" ? "global" : "project";
  const previous = context.sourcePaths.get(payload.workingDirectory) ?? {};
  context.sourcePaths.set(payload.workingDirectory, {
    ...previous,
    [scope]: sourcePathIndex(payload)
  });
  context.registry.register(scope, payload);
  return payload;
}

const sessionError = {
  error: "Session expired or missing. Reopen the URL printed by agent-mapper."
};

/** Projects, removal, and worktrees. A fresh project list also updates where skills may be copied. */
async function handleProjectRoute(
  context: RequestContext,
  url: URL
): Promise<boolean> {
  const { request, response } = context;
  const routed =
    (await projectRoute({
      request,
      url,
      config: context.config,
      home: context.options.home ?? homedir()
    })) ?? (await worktreeRoute(request, url));
  if (!routed) {
    return false;
  }
  if ("projects" in routed) {
    rememberProjects(context.discovered, routed);
  }
  sendJson({ response, status: status.ok, payload: routed });
  return true;
}

async function handleApi(context: RequestContext, url: URL): Promise<void> {
  const { request, response } = context;
  if (request.headers.authorization !== `Bearer ${context.token}`) {
    sendJson({ response, status: status.unauthorized, payload: sessionError });
    return;
  }
  if (await handleProjectRoute(context, url)) {
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/inventory") {
    sendJson({
      response,
      status: status.ok,
      payload: await inventoryPayload(context, url)
    });
    return;
  }
  if (isDocumentRoute(url.pathname)) {
    const launch = context.options.launchSource ?? launchOpen;
    await handleDocumentRoute(context.documents, {
      request,
      response,
      url,
      launch
    });
    return;
  }
  if (await handleItemRoute(context, { request, response, url })) {
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/source-action") {
    await performSourceAction({
      request,
      paths: context.sourcePaths,
      launch: context.options.launchSource
    });
    sendJson({ response, status: status.ok, payload: { ok: true } });
    return;
  }
  sendJson({
    response,
    status: status.missing,
    payload: { error: "Unknown API route." }
  });
}

async function handleRequest(context: RequestContext): Promise<void> {
  const address = context.server.address();
  const allowedHost =
    address && typeof address !== "string"
      ? `127.0.0.1:${address.port}`
      : undefined;
  const { request, response } = context;
  if (
    request.headers.host !== allowedHost ||
    (request.headers.origin &&
      request.headers.origin !== `http://${allowedHost}`)
  ) {
    sendJson({
      response,
      status: status.forbidden,
      payload: {
        error:
          "This local server accepts requests only from its own browser origin."
      }
    });
    return;
  }
  const url = new URL(request.url ?? "/", `http://${allowedHost}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(context, url);
  } else {
    await serveAsset(
      { request, response: context.response, url },
      context.options.webRoot
    );
  }
}

export function createAppServer(options: AppServerOptions): AppServer {
  const token = randomBytes(tokenBytes).toString("hex");
  const services = createServices(options);
  const config = new ConfigStore(
    options.configPath ?? defaultConfigPath(options.home ?? homedir())
  );
  const server = createServer((request, response) => {
    void handleRequest({
      request,
      response,
      server,
      token,
      options,
      ...services,
      config
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson({
        response,
        status: status.badRequest,
        payload: { error: message }
      });
    });
  });
  return {
    token,
    listen: () =>
      new Promise((finish, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () =>
          finish(server.address() as AddressInfo)
        );
      }),
    close: () =>
      new Promise((finish, reject) =>
        server.close((error) => (error ? reject(error) : finish()))
      )
  };
}
