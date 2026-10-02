import { createContext, use } from "react";
import {
  fileManagerWords,
  type FileManagerWords,
  type HostInfo
} from "@agent-mapper/core";

/** The server's platform. Reveal and the Trash act on that machine, even from a browser elsewhere. */
export const HostContext = createContext<HostInfo | undefined>(undefined);

export function useHost(): HostInfo {
  const host = use(HostContext);
  if (!host) {
    throw new Error(
      "The server's platform is unavailable. Render this view inside App."
    );
  }
  return host;
}

export function useFileManagerWords(): FileManagerWords {
  return fileManagerWords(useHost().platform);
}
