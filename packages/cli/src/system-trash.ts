import { spawn } from "node:child_process";
import { documentError, errnoCode } from "./source-document-errors";

/** Moves paths to the user's Trash, where the file manager can restore them. */
export type MoveToTrash = (path: string) => Promise<void>;

interface TrashCommand {
  name: string;
  args: (path: string) => string[];
  /** Why the command is missing, and what to do instead. */
  missing: string;
  fallback: string;
}

const macTrash: TrashCommand = {
  // macOS 15 and later ship `/usr/bin/trash`.
  name: "/usr/bin/trash",
  args: (path) => [path],
  missing:
    "Moving to the Trash needs macOS 15 or later. Delete the file in Finder instead.",
  fallback: "Delete it in Finder instead."
};

const gioTrash: TrashCommand = {
  // `gio trash` refuses unsupported mounts, and elsewhere needs `.Trash-$uid` at the mount root.
  name: "gio",
  args: (path) => ["trash", path],
  missing:
    "Moving to the Trash needs `gio`. Install libglib2.0-bin (or your distribution's glib2 package), or delete the file in your file manager instead.",
  fallback: "Delete it in your file manager instead."
};

const trashCommands = new Map<NodeJS.Platform, TrashCommand>([
  ["darwin", macTrash],
  ["linux", gioTrash]
]);

function runTrash(
  command: TrashCommand,
  input: { path: string; env: NodeJS.ProcessEnv }
): Promise<void> {
  const { path } = input;
  return new Promise((finish, reject) => {
    const child = spawn(command.name, command.args(path), {
      stdio: ["ignore", "ignore", "pipe"],
      env: input.env
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) =>
      reject(
        errnoCode(error) === "ENOENT"
          ? documentError("io_error", command.missing)
          : error
      )
    );
    // The command's own explanation of a refusal is passed on.
    child.once("close", (code, signal) =>
      code === 0
        ? finish()
        : reject(
            documentError(
              "io_error",
              `The Trash refused ${path} (${stderr.trim() || (signal ? `trash stopped by ${signal}` : `trash exited with status ${code}`)}). ${command.fallback}`
            )
          )
    );
  });
}

/** The platform's own Trash command. Nothing is deleted when it is missing or refuses. */
export function systemTrash(host: {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
}): MoveToTrash {
  const command = trashCommands.get(host.platform);
  return async (path) => {
    if (!command) {
      throw documentError(
        "io_error",
        `Moving to the Trash works on macOS and Linux, not ${host.platform}. Delete the file yourself instead.`
      );
    }
    await runTrash(command, { path, env: host.env });
  };
}
