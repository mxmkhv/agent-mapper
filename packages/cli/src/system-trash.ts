import { spawn } from "node:child_process";
import { documentError, errnoCode } from "./source-document-errors";

/** Moves paths to the user's Trash, where Finder's Put Back can restore them. */
export type MoveToTrash = (path: string) => Promise<void>;

/** macOS 15 and later ship `/usr/bin/trash`. Its own explanation of a refusal is passed on. */
export function systemTrash(path: string): Promise<void> {
  return new Promise((finish, reject) => {
    const child = spawn("/usr/bin/trash", [path], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) =>
      reject(
        errnoCode(error) === "ENOENT"
          ? documentError(
              "io_error",
              "Moving to the Trash needs macOS 15 or later. Delete the file in Finder instead."
            )
          : error
      )
    );
    child.once("close", (code, signal) =>
      code === 0
        ? finish()
        : reject(
            documentError(
              "io_error",
              `The Trash refused ${path} (${stderr.trim() || (signal ? `trash stopped by ${signal}` : `trash exited with status ${code}`)}). Delete it in Finder instead.`
            )
          )
    );
  });
}
