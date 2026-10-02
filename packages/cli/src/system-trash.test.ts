import { afterEach, expect, it } from "vitest";
import { fakeCommands } from "./fake-command-test-kit";
import { systemTrash } from "./system-trash";

const bins: ReturnType<typeof fakeCommands>[] = [];
afterEach(() => {
  for (const bin of bins.splice(0)) {
    bin.remove();
  }
});

function linuxTrash(scripts: Record<string, string>) {
  const bin = fakeCommands(scripts);
  bins.push(bin);
  // No DISPLAY: the Trash works over SSH too.
  return { trash: systemTrash({ platform: "linux", env: bin.env }), bin };
}

it("moves items to the Trash with gio, without a desktop session", async () => {
  const { trash, bin } = linuxTrash({ gio: "exit 0" });
  await trash("/home/max/.claude/skills/review");
  expect(bin.calls("gio")).toEqual([
    ["trash", "/home/max/.claude/skills/review"]
  ]);
});

it("passes on gio's refusal and says what to do", async () => {
  const { trash } = linuxTrash({
    gio: "echo 'gio: Trashing on system internal mounts is not supported' >&2; exit 2"
  });
  await expect(trash("/mnt/data/review")).rejects.toThrow(
    "The Trash refused /mnt/data/review (gio: Trashing on system internal mounts is not supported). Delete it in your file manager instead."
  );
});

it("names the package to install when gio is missing", async () => {
  const { trash } = linuxTrash({});
  await expect(trash("/home/max/review")).rejects.toThrow(
    "Moving to the Trash needs `gio`. Install libglib2.0-bin"
  );
});

it("refuses platforms without a supported Trash", async () => {
  await expect(
    systemTrash({ platform: "win32", env: {} })("C:/review")
  ).rejects.toThrow("Moving to the Trash works on macOS and Linux, not win32.");
});
