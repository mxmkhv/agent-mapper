import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import { buildSnapshot } from "./service";
import type { AppServerOptions } from "./server";

interface ActionContext {
  request: IncomingMessage;
  options: AppServerOptions;
}
const requestLimit = 16_384;

async function readJson(
  request: IncomingMessage
): Promise<Record<string, string>> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > requestLimit) {
      throw new Error("Request is too large. Submit a shorter path.");
    }
  }
  const value: unknown = JSON.parse(body);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Request must be a JSON object.");
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}

function launchOpen(args: string[]): Promise<void> {
  return new Promise((finish, reject) => {
    const child = spawn("open", args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? finish()
        : reject(new Error(`macOS open exited with status ${code}.`))
    );
  });
}

export async function performSourceAction(
  context: ActionContext
): Promise<void> {
  const body = await readJson(context.request);
  if (!body.path || !body.id || !body.action) {
    throw new Error("Choose a source and action.");
  }
  if (body.action !== "open" && body.action !== "reveal") {
    throw new Error("Choose Open or Reveal.");
  }
  const snapshot = await buildSnapshot(body.path, {
    home: context.options.home,
    codexHome: context.options.codexHome
  });
  const source =
    snapshot.items.find((item) => item.entry.id === body.id)?.entry.path ??
    snapshot.plugins.find((plugin) => plugin.id === body.id)?.sourcePath ??
    snapshot.hooks.find((hook) => hook.id === body.id)?.sourcePath;
  if (!source) {
    throw new Error("Source is no longer in this scan. Rescan and try again.");
  }
  await launchOpen(body.action === "reveal" ? ["-R", source] : [source]);
}
