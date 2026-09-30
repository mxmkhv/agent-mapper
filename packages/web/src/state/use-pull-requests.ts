import { useEffect, useState } from "react";
import type { PullRequestLookup } from "@agent-mapper/core";
import { getPullRequests } from "../api";

type PullRequestState =
  | { status: "loading" }
  | { status: "done"; lookup: PullRequestLookup }
  | { status: "error"; message: string };

interface CachedLookup {
  refresh: number;
  request: Promise<PullRequestLookup>;
  settled?: PullRequestLookup;
}

/**
 * One `gh pr list` per repository per scan. Leaving and reopening the Worktrees view, or switching folders,
 * reuses the answer; a rescan (new `refresh`) asks again. Failures are dropped so the next visit retries.
 * The request is never aborted: another view may be waiting on it.
 */
const lookups = new Map<string, CachedLookup>();

export function pullRequestLookup(path: string, refresh: number): CachedLookup {
  const cached = lookups.get(path);
  if (cached?.refresh === refresh) {
    return cached;
  }
  const entry: CachedLookup = { refresh, request: getPullRequests(path) };
  entry.request.then(
    (lookup) => {
      entry.settled = lookup;
    },
    () => {
      if (lookups.get(path) === entry) {
        lookups.delete(path);
      }
    }
  );
  lookups.set(path, entry);
  return entry;
}

function settledLookup(path: string, refresh: number) {
  const cached = lookups.get(path);
  return cached?.refresh === refresh ? cached.settled : undefined;
}

/** Pull requests for a repository, shared across mounts and fetched again on each rescan. */
export function usePullRequests(
  path: string | undefined,
  refresh: number
): PullRequestState {
  const key = `${refresh}\n${path ?? ""}`;
  const [state, setState] = useState<{ key: string; value: PullRequestState }>({
    key: "",
    value: { status: "loading" }
  });
  useEffect(() => {
    if (!path) {
      return undefined;
    }
    let active = true;
    pullRequestLookup(path, refresh).request.then(
      (lookup) =>
        active && setState({ key, value: { status: "done", lookup } }),
      (error: unknown) =>
        active &&
        setState({
          key,
          value: {
            status: "error",
            message: error instanceof Error ? error.message : String(error)
          }
        })
    );
    return () => {
      active = false;
    };
  }, [key, path, refresh]);
  if (state.key === key) {
    return state.value;
  }
  // A cached answer renders at once on remount instead of flashing a loading state.
  const settled = path ? settledLookup(path, refresh) : undefined;
  return settled ? { status: "done", lookup: settled } : { status: "loading" };
}
