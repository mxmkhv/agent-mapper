import { afterEach, expect, it } from "vitest";
import { createDesktop } from "./desktop";
import { fakeCommands } from "./fake-command-test-kit";

const bins: ReturnType<typeof fakeCommands>[] = [];
afterEach(() => {
  for (const bin of bins.splice(0)) {
    bin.remove();
  }
});

function helpers() {
  const bin = fakeCommands({
    open: "exit 0",
    "xdg-open": "exit 0",
    gdbus: "exit 0"
  });
  bins.push(bin);
  return bin;
}

const linux = "Linux version 6.8.0-generic";
const requests = [
  { action: "open", path: "/home/max/AGENTS.md" },
  { action: "reveal", path: "/home/max/AGENTS.md" }
] as const;

it("skips the browser and refuses Open and Reveal without a desktop session", async () => {
  const bin = helpers();
  const desktop = createDesktop({
    platform: "linux",
    env: bin.env,
    procVersion: () => linux
  });
  await expect(
    desktop({ action: "browse", url: "http://127.0.0.1:4000/" })
  ).rejects.toThrow("There is no desktop session here");
  for (const request of requests) {
    await expect(desktop(request)).rejects.toThrow(
      "Files cannot be opened or shown from here"
    );
  }
  expect([...bin.calls("xdg-open"), ...bin.calls("gdbus")]).toEqual([]);
});

it("treats WSL as unsupported even when WSLg sets the display variables", async () => {
  const bin = helpers();
  const display = { DISPLAY: ":0", WAYLAND_DISPLAY: "wayland-0" };
  const named = createDesktop({
    platform: "linux",
    env: { ...bin.env, ...display, WSL_DISTRO_NAME: "Ubuntu" },
    procVersion: () => linux
  });
  const kernel = createDesktop({
    platform: "linux",
    env: { ...bin.env, ...display },
    procVersion: () => "Linux version 5.15.153.1-microsoft-standard-WSL2"
  });
  for (const desktop of [named, kernel]) {
    await expect(
      desktop({ action: "browse", url: "http://127.0.0.1:4000/" })
    ).rejects.toThrow("not supported on WSL yet");
    await expect(desktop(requests[1])).rejects.toThrow(
      "not supported on WSL yet"
    );
  }
  expect(bin.calls("xdg-open")).toEqual([]);
});

it("uses macOS open, selecting the item for Reveal", async () => {
  const bin = helpers();
  const desktop = createDesktop({ platform: "darwin", env: bin.env });
  await desktop({ action: "browse", url: "http://127.0.0.1:4000/" });
  for (const request of requests) {
    await desktop(request);
  }
  expect(bin.calls("open").sort()).toEqual([
    ["-R", "/home/max/AGENTS.md"],
    ["/home/max/AGENTS.md"],
    ["http://127.0.0.1:4000/"]
  ]);
});

it("names the supported platforms elsewhere", async () => {
  const desktop = createDesktop({ platform: "win32", env: {} });
  await expect(desktop(requests[0])).rejects.toThrow(
    "Desktop actions support macOS and Linux, not win32."
  );
});
