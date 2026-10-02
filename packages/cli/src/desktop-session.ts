import { readFileSync } from "node:fs";
import type { HostInfo } from "@agent-mapper/core";
import { errnoCode } from "./source-document-errors";

export interface SessionHost {
  platform: NodeJS.Platform;
  /** DISPLAY, WAYLAND_DISPLAY and WSL_DISTRO_NAME decide whether there is a desktop session. */
  env: NodeJS.ProcessEnv;
  /** Contents of /proc/version, which names Microsoft under WSL. */
  procVersion?: () => string;
}

/** Only an available session names a platform, so desktop code can't run on one it doesn't support. */
type Session =
  | { available: true; platform: "darwin" | "linux" }
  | { available: false; reason: string };

export function hostInfo(platform: NodeJS.Platform): HostInfo {
  if (platform === "darwin") {
    return { platform: "macos" };
  }
  return { platform: platform === "linux" ? "linux" : "other" };
}

function readProcVersion(): string {
  try {
    return readFileSync("/proc/version", "utf8");
  } catch (error) {
    // Some sandboxes hide /proc; that is not WSL.
    if (errnoCode(error) === "ENOENT") {
      return "";
    }
    throw error;
  }
}

/** Under WSL, or undefined; a failed check turns desktop actions off instead of stopping agent-mapper. */
function wslReason(host: SessionHost): string | undefined {
  if (host.env.WSL_DISTRO_NAME) {
    return "Desktop actions are not supported on WSL yet.";
  }
  let version: string;
  try {
    version = (host.procVersion ?? readProcVersion)();
  } catch (error) {
    return `Could not read /proc/version (${errnoCode(error) ?? String(error)}) to check for WSL, so desktop actions are off.`;
  }
  return /microsoft/i.test(version)
    ? "Desktop actions are not supported on WSL yet."
    : undefined;
}

/** Over SSH, in containers, and on WSL there is no desktop to open the browser or a file on. */
export function desktopSession(host: SessionHost): Session {
  if (host.platform === "darwin") {
    return { available: true, platform: "darwin" };
  }
  if (host.platform !== "linux") {
    return {
      available: false,
      reason: `Desktop actions support macOS and Linux, not ${host.platform}.`
    };
  }
  // WSLg sets DISPLAY and WAYLAND_DISPLAY too, so WSL is checked first.
  const wsl = wslReason(host);
  if (wsl) {
    return { available: false, reason: wsl };
  }
  if (!host.env.DISPLAY && !host.env.WAYLAND_DISPLAY) {
    return {
      available: false,
      reason:
        "There is no desktop session here (DISPLAY and WAYLAND_DISPLAY are unset)."
    };
  }
  return { available: true, platform: "linux" };
}
