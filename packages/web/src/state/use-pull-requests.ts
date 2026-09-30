import { useEffect, useState } from "react";
import type { PullRequestLookup } from "@agent-mapper/core";
import { getPullRequests } from "../api";

type PullRequestState =
  | { status: "loading" }
  | { status: "done"; lookup: PullRequestLookup }
  | { status: "error"; message: string };

/** Pull requests for a repository, fetched again on each rescan. Nothing is fetched without a path. */
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
    const controller = new AbortController();
    void getPullRequests(path, controller.signal).then(
      (lookup) => setState({ key, value: { status: "done", lookup } }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            value: {
              status: "error",
              message: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    );
    return () => controller.abort();
  }, [key, path]);
  return state.key === key ? state.value : { status: "loading" };
}
