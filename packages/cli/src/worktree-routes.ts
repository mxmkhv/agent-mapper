import type { IncomingMessage } from "node:http";
import type { PullRequestLookup } from "@agent-mapper/core";
import { pullRequests } from "./pull-requests";
import { readJson } from "./source-actions";
import { removeWorktree } from "./worktree-remove";

/** Worktree removal and pull request status. Undefined when the route belongs elsewhere. */
export async function worktreeRoute(
  request: IncomingMessage,
  url: URL
): Promise<PullRequestLookup | { ok: true } | undefined> {
  if (
    request.method === "GET" &&
    url.pathname === "/api/worktrees/pull-requests"
  ) {
    return pullRequests(url.searchParams.get("path"));
  }
  if (request.method === "POST" && url.pathname === "/api/worktrees/remove") {
    await removeWorktree((await readJson(request)).path);
    return { ok: true };
  }
  return undefined;
}
