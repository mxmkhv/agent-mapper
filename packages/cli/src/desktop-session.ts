import { readFileSync } from "node:fs";
import type { HostInfo } from "@agent-mapper/core";
import { errnoCode } from "./source-document-errors";

export interface SessionHost {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** Contents of /proc/version, which names Microsoft under WSL. */
  procVersion?: () => string;
}

type Session = { available: true } | { available: false; reason: string };

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

/** Over SSH, in containers, and on WSL there is no desktop to open the browser or a file on. */
export function desktopSession(host: SessionHost): Session {
  if (host.platform === "darwin") {
    return { available: true };
  }
  if (host.platform !== "linux") {
    return {
      available: false,
      reason: `Desktop actions support macOS and Linux, not ${host.platform}.`
    };
  }
  // WSLg sets DISPLAY and WAYLAND_DISPLAY too, so WSL is checked first.
  if (
    host.env.WSL_DISTRO_NAME ||
    /microsoft/i.test((host.procVersion ?? readProcVersion)())
  ) {
    return {
      available: false,
      reason: "Desktop actions are not supported on WSL yet."
    };
  }
  if (!host.env.DISPLAY && !host.env.WAYLAND_DISPLAY) {
    return {
      available: false,
      reason:
        "There is no desktop session here (DISPLAY and WAYLAND_DISPLAY are unset)."
    };
  }
  return { available: true };
}
