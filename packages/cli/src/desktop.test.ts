import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { createDesktop } from "./desktop";
import { fakeCommands } from "./fake-command-test-kit";

const notExecutable = 0o644;
const bins: ReturnType<typeof fakeCommands>[] = [];
afterEach(() => {
  for (const bin of bins.splice(0)) {
    bin.remove();
  }
});

/**
 * A Linux desktop session whose helpers are the given scripts. A fresh script can take most of a
 * second to start on macOS, so windows are long unless a test waits one out on purpose;
 * a script that exits resolves at once either way.
 */
function linuxDesktop(scripts: Record<string, string>, windowMs = 10_000) {
  const bin = fakeCommands(scripts);
  bins.push(bin);
  const desktop = createDesktop({
    platform: "linux",
    env: { ...bin.env, WAYLAND_DISPLAY: "wayland-0" },
    procVersion: () => "Linux version 6.8.0-generic",
    launchWindowMs: windowMs,
    revealWindowMs: windowMs
  });
  return { desktop, calls: bin.calls, bin: bin.env.PATH };
}

const showItemsArguments = (uri: string) => [
  "call",
  "--session",
  "--dest",
  "org.freedesktop.FileManager1",
  "--object-path",
  "/org/freedesktop/FileManager1",
  "--method",
  "org.freedesktop.FileManager1.ShowItems",
  `['${uri}']`,
  ""
];

it("browses and opens through xdg-open", async () => {
  const { desktop, calls } = linuxDesktop({ "xdg-open": "exit 0" });
  await desktop({ action: "browse", url: "http://127.0.0.1:4000/#token" });
  await desktop({ action: "open", path: "/home/max/AGENTS.md" });
  expect(calls("xdg-open").sort()).toEqual([
    ["/home/max/AGENTS.md"],
    ["http://127.0.0.1:4000/#token"]
  ]);
});

it("names the package to install when xdg-open is missing", async () => {
  const { desktop } = linuxDesktop({});
  await expect(
    desktop({ action: "open", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow("Install xdg-utils");
});

it("explains xdg-open finding no tool, and no default app for a file type", async () => {
  const noTool = linuxDesktop({ "xdg-open": "exit 3" });
  await expect(
    noTool.desktop({ action: "browse", url: "http://127.0.0.1:4000/" })
  ).rejects.toThrow("xdg-open found no program to open");
  const noApp = linuxDesktop({ "xdg-open": "exit 4" });
  await expect(
    noApp.desktop({ action: "open", path: "/home/max/.codex/config.toml" })
  ).rejects.toThrow(
    "No app is set to open .toml files. Set a default app for .toml files, or use Show in file manager."
  );
});

it("fails on a nonzero exit inside the launch window, and leaves a running launcher alone", async () => {
  const failing = linuxDesktop({ "xdg-open": "exit 1" });
  await expect(
    failing.desktop({ action: "open", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow("xdg-open exited with status 1");
  const lingering = linuxDesktop({ "xdg-open": "exec /bin/sleep 10" }, 1500);
  await expect(
    lingering.desktop({ action: "open", path: "/home/max/AGENTS.md" })
  ).resolves.toBeUndefined();
});

it("reveals through the file manager's ShowItems, without a fallback on success", async () => {
  const { desktop, calls } = linuxDesktop({
    gdbus: "exit 0",
    "xdg-open": "exit 0"
  });
  await desktop({ action: "reveal", path: "/home/max/skills/review" });
  expect(calls("gdbus")).toEqual([
    showItemsArguments("file:///home/max/skills/review")
  ]);
  expect(calls("xdg-open")).toEqual([]);
});

it("opens the parent folder when ShowItems fails or gdbus is missing", async () => {
  const refused = linuxDesktop({ gdbus: "exit 1", "xdg-open": "exit 0" });
  await refused.desktop({ action: "reveal", path: "/home/max/skills/review" });
  expect(refused.calls("xdg-open")).toEqual([["/home/max/skills"]]);
  const missing = linuxDesktop({ "xdg-open": "exit 0" });
  await missing.desktop({ action: "reveal", path: "/home/max/AGENTS.md" });
  expect(missing.calls("xdg-open")).toEqual([["/home/max"]]);
});

it("reports both failures when ShowItems and the parent folder fallback fail", async () => {
  const { desktop } = linuxDesktop({ gdbus: "exit 1", "xdg-open": "exit 3" });
  await expect(
    desktop({ action: "reveal", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow(
    "The file manager refused ShowItems: gdbus exited with status 1. Opening the parent folder failed too: xdg-open found no program"
  );
  const bare = linuxDesktop({});
  await expect(
    bare.desktop({ action: "reveal", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow(
    "gdbus was not found. Install libglib2.0-bin or your distribution's glib2 package. Opening the parent folder failed too: xdg-open was not found. Install xdg-utils"
  );
});

it("opens the parent folder when gdbus is not executable", async () => {
  const { desktop, calls, bin } = linuxDesktop({
    gdbus: "exit 0",
    "xdg-open": "exit 0"
  });
  chmodSync(join(bin, "gdbus"), notExecutable);
  await desktop({ action: "reveal", path: "/home/max/skills/review" });
  expect(calls("gdbus")).toEqual([]);
  expect(calls("xdg-open")).toEqual([["/home/max/skills"]]);
});

it("names a helper that exists but cannot run", async () => {
  const { desktop, bin } = linuxDesktop({
    gdbus: "exit 0",
    "xdg-open": "exit 0"
  });
  chmodSync(join(bin, "gdbus"), notExecutable);
  chmodSync(join(bin, "xdg-open"), notExecutable);
  await expect(
    desktop({ action: "reveal", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow(
    "Could not start gdbus (EACCES). Check that it is executable, or reinstall it. Opening the parent folder failed too: Could not start xdg-open (EACCES)."
  );
});

it("says a file xdg-open reports missing should be rescanned", async () => {
  const { desktop } = linuxDesktop({ "xdg-open": "exit 2" });
  await expect(
    desktop({ action: "open", path: "/home/max/AGENTS.md" })
  ).rejects.toThrow(
    "/home/max/AGENTS.md no longer exists. Rescan and try again."
  );
});

it("counts a slow ShowItems call it stopped as launched, with no second window", async () => {
  const { desktop, calls } = linuxDesktop(
    { gdbus: "exec /bin/sleep 10", "xdg-open": "exit 0" },
    3000
  );
  await desktop({ action: "reveal", path: "/home/max/AGENTS.md" });
  expect(calls("gdbus")).toHaveLength(1);
  expect(calls("xdg-open")).toEqual([]);
});

it("starts helpers in their own process group, so Ctrl+C leaves the app running", async () => {
  const { desktop, bin } = linuxDesktop({
    "xdg-open": `/bin/ps -o pgid= -p $$ > "$0.pgid"`
  });
  await desktop({ action: "browse", url: "http://127.0.0.1:4000/" });
  const ours = execFileSync("/bin/ps", [
    "-o",
    "pgid=",
    "-p",
    String(process.pid)
  ])
    .toString()
    .trim();
  const theirs = readFileSync(join(bin, "xdg-open.pgid"), "utf8").trim();
  expect(theirs).not.toBe("");
  expect(theirs).not.toBe(ours);
});

it("passes awkward filenames to gdbus as one intact file URI", async () => {
  const { desktop, calls } = linuxDesktop({ gdbus: "exit 0" });
  const path = `/home/max/a b%c#d'e"f\\g-ü.md`;
  await desktop({ action: "reveal", path });
  const uri = calls("gdbus")[0]?.[8]?.slice(2, -2) ?? "";
  expect(uri).toBe("file:///home/max/a%20b%25c%23d%27e%22f%5Cg-%C3%BC.md");
  expect(fileURLToPath(uri)).toBe(path);
});
