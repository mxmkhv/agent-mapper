/** The machine running agent-mapper's server, which may differ from the machine running the browser. */
export interface HostInfo {
  platform: "macos" | "linux" | "other";
}

/** File manager wording for the server's platform, since Reveal and the Trash act on that machine. */
export interface FileManagerWords {
  reveal: string;
  openFolder: string;
  /** How to bring a trashed item back. */
  restore: string;
}

export function fileManagerWords(
  platform: HostInfo["platform"]
): FileManagerWords {
  return platform === "macos"
    ? {
        reveal: "Reveal in Finder",
        openFolder: "Open in Finder",
        restore: "Use Put Back in the Trash."
      }
    : {
        reveal: "Show in file manager",
        openFolder: "Open in file manager",
        restore: "Restore it from the Trash."
      };
}
