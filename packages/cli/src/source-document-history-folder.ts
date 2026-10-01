import { lstat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  DocumentApiError,
  documentError,
  errnoCode
} from "./source-document-errors";

const privateDirectory = 0o700;
const groupOrOtherBits = 0o077;

/** macOS keeps app data in Application Support; other platforms use an absolute XDG_DATA_HOME or ~/.local/share. */
export function defaultHistoryRoot(home: string): string {
  if (process.platform === "darwin") {
    return join(
      home,
      "Library",
      "Application Support",
      "agent-mapper",
      "revisions"
    );
  }
  const xdg = process.env.XDG_DATA_HOME;
  return join(
    xdg?.startsWith("/") ? xdg : join(home, ".local", "share"),
    "agent-mapper",
    "revisions"
  );
}

async function privateFolder(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: privateDirectory });
  const info = await lstat(path);
  const owned = !process.getuid || info.uid === process.getuid();
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    !owned ||
    info.mode & groupOrOtherBits
  ) {
    throw documentError(
      "history_unavailable",
      `History folder ${path} must be a private folder you own (not a symlink, mode 700). Fix it, then save again.`
    );
  }
}

/** The private history folder for one file, created on first use. Fails before any source write. */
export async function historyFolder(
  root: string,
  sourceKey: string
): Promise<string> {
  const folder = join(root, sourceKey);
  try {
    await privateFolder(root);
    await privateFolder(folder);
  } catch (error) {
    if (error instanceof DocumentApiError) {
      throw error;
    }
    throw documentError(
      "history_unavailable",
      `Could not prepare history folder ${folder} (${errnoCode(error) ?? String(error)}). Nothing was changed.`
    );
  }
  return folder;
}
