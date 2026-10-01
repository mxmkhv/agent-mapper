import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf"
} as const;

/**
 * Monaco injects generated `<style>` rules and runs same-origin module workers, so styles allow
 * inline rules and workers/fonts are same-origin. Scripts and connections stay same-origin only.
 */
const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'";

const status = { ok: 200, forbidden: 403, missing: 404, method: 405 } as const;

function sendError(
  response: ServerResponse,
  reply: { status: number; error: string }
): void {
  response.writeHead(reply.status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify({ error: reply.error }));
}

export async function serveAsset(
  input: { request: IncomingMessage; response: ServerResponse; url: URL },
  webRoot: string
): Promise<void> {
  const { request, response, url } = input;
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendError(response, {
      status: status.method,
      error: "Only GET and HEAD are supported here."
    });
    return;
  }
  const root = resolve(webRoot);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const asset = resolve(root, relative);
  if (asset !== root && !asset.startsWith(`${root}${sep}`)) {
    sendError(response, {
      status: status.forbidden,
      error: "Asset path is outside the app."
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
    sendError(response, {
      status: status.missing,
      error: "App asset is missing. Rebuild the workspace."
    });
    return;
  }
  response.writeHead(status.ok, {
    "content-type":
      mimeTypes[extname(asset) as keyof typeof mimeTypes] ??
      "application/octet-stream",
    "content-security-policy": contentSecurityPolicy,
    "x-content-type-options": "nosniff"
  });
  response.end(request.method === "HEAD" ? undefined : bytes);
}
