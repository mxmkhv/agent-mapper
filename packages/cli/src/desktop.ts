import { spawn } from "node:child_process";
import { dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { desktopSession, type SessionHost } from "./desktop-session";
import { errnoCode } from "./source-document-errors";

export type DesktopRequest =
  | { action: "browse"; url: string }
  | { action: "open" | "reveal"; path: string };

/** Hands a URL or file to the desktop. Resolves once the app is launched, not when it closes. */
export type Desktop = (request: DesktopRequest) => Promise<void>;

/** A desktop action that cannot run here; the message says why and what to do instead. */
export class DesktopError extends Error {}

/** `env` decides whether there is a desktop session, and gives helper commands their PATH. */
interface DesktopHost extends SessionHost {
  /** How long a launcher may run before it counts as launched. */
  launchWindowMs?: number;
  /** How long the file manager may take to answer over D-Bus. */
  revealWindowMs?: number;
}

type Outcome =
  | { kind: "exited"; code: number | null; signal: NodeJS.Signals | null }
  | { kind: "running" }
  | { kind: "missing" };

interface Launcher {
  env: NodeJS.ProcessEnv;
  launchWindowMs: number;
  revealWindowMs: number;
}

const defaultLaunchWindowMs = 2000;
// A file manager cold-started over D-Bus can take more than a second to answer.
const defaultRevealWindowMs = 5000;
const xdgNoTool = 3;
const xdgActionFailed = 4;

/** Starts `command` detached, so Ctrl+C on agent-mapper leaves the app it launched running. */
function watch(
  launcher: Launcher,
  command: { name: string; args: string[]; windowMs: number; kill?: boolean }
): Promise<Outcome> {
  const child = spawn(command.name, command.args, {
    detached: true,
    stdio: "ignore",
    env: launcher.env
  });
  child.unref();
  return new Promise((finish, reject) => {
    // Launchers such as xdg-open may stay alive as long as the app they started.
    const timer = setTimeout(() => {
      if (command.kill) {
        child.kill();
      }
      finish({ kind: "running" });
    }, command.windowMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      if (errnoCode(error) === "ENOENT") {
        finish({ kind: "missing" });
      } else {
        reject(error);
      }
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      finish({ kind: "exited", code, signal });
    });
  });
}

function launched(outcome: Outcome): boolean {
  return (
    outcome.kind === "running" ||
    (outcome.kind === "exited" && outcome.code === 0)
  );
}

function exitText(
  command: string,
  outcome: Extract<Outcome, { kind: "exited" }>
): string {
  return outcome.signal
    ? `${command} was stopped by ${outcome.signal}.`
    : `${command} exited with status ${outcome.code}.`;
}

async function macOpen(launcher: Launcher, args: string[]): Promise<void> {
  const outcome = await watch(launcher, {
    name: "open",
    args,
    windowMs: launcher.launchWindowMs
  });
  if (outcome.kind === "missing") {
    throw new DesktopError(
      "macOS `open` was not found. Check that /usr/bin is on your PATH."
    );
  }
  if (!launched(outcome) && outcome.kind === "exited") {
    throw new DesktopError(exitText("macOS open", outcome));
  }
}

async function xdgOpen(
  launcher: Launcher,
  target: { path: string; file?: boolean }
): Promise<void> {
  const outcome = await watch(launcher, {
    name: "xdg-open",
    args: [target.path],
    windowMs: launcher.launchWindowMs
  });
  if (outcome.kind === "missing") {
    throw new DesktopError(
      "xdg-open is not installed. Install xdg-utils, then try again."
    );
  }
  if (launched(outcome) || outcome.kind !== "exited") {
    return;
  }
  if (outcome.code === xdgNoTool) {
    throw new DesktopError(
      `xdg-open found no program to open ${target.path}. Set a default app in your desktop settings, then try again.`
    );
  }
  if (outcome.code === xdgActionFailed && target.file) {
    const extension = extname(target.path);
    throw new DesktopError(
      `No app is set to open ${extension} files. Set a default app for ${extension} files, or use Show in file manager.`
    );
  }
  throw new DesktopError(
    `Could not open ${target.path}: ${exitText("xdg-open", outcome)}`
  );
}

/**
 * The URI goes inside a GVariant string literal, which `gdbus call` parses.
 * `pathToFileURL` leaves `'` alone, and that would end the literal.
 */
function fileManagerUri(path: string): string {
  return pathToFileURL(path).href.replaceAll("'", "%27");
}

/**
 * Asks the file manager to select `path`. If the call fails for any reason we did not cause,
 * such as no session bus or a file manager without ShowItems, the parent folder opens instead.
 */
async function showItem(launcher: Launcher, path: string): Promise<void> {
  const outcome = await watch(launcher, {
    name: "gdbus",
    args: [
      "call",
      "--session",
      "--dest",
      "org.freedesktop.FileManager1",
      "--object-path",
      "/org/freedesktop/FileManager1",
      "--method",
      "org.freedesktop.FileManager1.ShowItems",
      `['${fileManagerUri(path)}']`,
      ""
    ],
    windowMs: launcher.revealWindowMs,
    // A slow answer may still show the window, so killing the call is not a failure and opens nothing else.
    kill: true
  });
  if (!launched(outcome)) {
    await xdgOpen(launcher, { path: dirname(path) });
  }
}

function linuxAction(
  launcher: Launcher,
  request: DesktopRequest
): Promise<void> {
  switch (request.action) {
    case "browse":
      return xdgOpen(launcher, { path: request.url });
    case "open":
      return xdgOpen(launcher, { path: request.path, file: true });
    case "reveal":
      return showItem(launcher, request.path);
  }
}

function macArguments(request: DesktopRequest): string[] {
  switch (request.action) {
    case "browse":
      return [request.url];
    case "open":
      return [request.path];
    case "reveal":
      return ["-R", request.path];
  }
}

export function createDesktop(host: DesktopHost): Desktop {
  const session = desktopSession(host);
  const launcher: Launcher = {
    env: host.env,
    launchWindowMs: host.launchWindowMs ?? defaultLaunchWindowMs,
    revealWindowMs: host.revealWindowMs ?? defaultRevealWindowMs
  };
  return async (request) => {
    if (!session.available) {
      throw new DesktopError(
        request.action === "browse"
          ? session.reason
          : `${session.reason} Files cannot be opened or shown from here; use the path in a terminal instead.`
      );
    }
    await (host.platform === "darwin"
      ? macOpen(launcher, macArguments(request))
      : linuxAction(launcher, request));
  };
}
