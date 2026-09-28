import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import { extname, resolve, sep } from "node:path";
import type { InventorySnapshot } from "@agent-mapper/core";
import { discoverProjects, type DiscoveryResult } from "./inventory";
import { buildGlobalSnapshot, buildSnapshot } from "./service";
import {
  performSourceAction,
  sourcePathIndex,
  type SourcePathStore
} from "./source-actions";

export interface AppServerOptions {
  home?: string;
  codexHome?: string;
  webRoot: string;
  launchSource?: (args: string[]) => Promise<void>;
}
export interface AppServer {
  token: string;
  listen(): Promise<AddressInfo>;
  close(): Promise<void>;
}

interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  server: Server;
  token: string;
  options: AppServerOptions;
  sourcePaths: SourcePathStore;
}

type ApiPayload =
  DiscoveryResult | InventorySnapshot | { error: string } | { ok: true };
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
  missing: 404,
  method: 405
} as const;
const tokenBytes = 32;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
} as const;

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
    codexHome: context.options.codexHome
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
  return payload;
}

async function handleApi(context: RequestContext, url: URL): Promise<void> {
  const { request, response } = context;
  if (request.headers.authorization !== `Bearer ${context.token}`) {
    sendJson({
      response,
      status: status.unauthorized,
      payload: {
        error:
          "Session expired or missing. Reopen the URL printed by agent-mapper."
      }
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/projects") {
    sendJson({
      response,
      status: status.ok,
      payload: await discoverProjects(context.options.home ?? homedir())
    });
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

async function serveAsset(context: RequestContext, url: URL): Promise<void> {
  const { request, response } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson({
      response,
      status: status.method,
      payload: { error: "Only GET and HEAD are supported here." }
    });
    return;
  }
  const root = resolve(context.options.webRoot);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const asset = resolve(root, relative);
  if (asset !== root && !asset.startsWith(`${root}${sep}`)) {
    sendJson({
      response,
      status: status.forbidden,
      payload: { error: "Asset path is outside the app." }
    });
    return;
  }
  let bytes;
  try {
    bytes = await readFile(asset);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    sendJson({
      response,
      status: status.missing,
      payload: { error: "App asset is missing. Rebuild the workspace." }
    });
    return;
  }
  response.writeHead(status.ok, {
    "content-type":
      mimeTypes[extname(asset) as keyof typeof mimeTypes] ??
      "application/octet-stream",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'",
    "x-content-type-options": "nosniff"
  });
  response.end(request.method === "HEAD" ? undefined : bytes);
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
    await serveAsset(context, url);
  }
}

export function createAppServer(options: AppServerOptions): AppServer {
  const token = randomBytes(tokenBytes).toString("hex");
  const sourcePaths: SourcePathStore = new Map();
  const server = createServer((request, response) => {
    void handleRequest({
      request,
      response,
      server,
      token,
      options,
      sourcePaths
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
