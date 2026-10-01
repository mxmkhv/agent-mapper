import { beforeEach, expect, it, vi } from "vitest";
import { getPullRequests } from "../api";
import { pullRequestLookup } from "./use-pull-requests";

vi.mock("../api", () => ({ getPullRequests: vi.fn() }));
const fetchLookup = vi.mocked(getPullRequests);

beforeEach(() => {
  fetchLookup.mockReset();
});

it("asks gh once per repository per scan, however often the view remounts", async () => {
  fetchLookup.mockResolvedValue({
    status: "ready",
    byBranch: {},
    truncated: false
  });
  const first = pullRequestLookup("/repo-a", 1);
  const again = pullRequestLookup("/repo-a", 1);
  expect(again).toBe(first);
  await first.request;
  expect(pullRequestLookup("/repo-a", 1).settled).toEqual({
    status: "ready",
    byBranch: {},
    truncated: false
  });
  expect(fetchLookup).toHaveBeenCalledTimes(1);

  pullRequestLookup("/repo-a", 2);
  expect(fetchLookup).toHaveBeenCalledTimes(2);
});

it("retries on the next visit after a failed lookup", async () => {
  fetchLookup.mockRejectedValueOnce(new Error("offline"));
  await expect(pullRequestLookup("/repo-b", 1).request).rejects.toThrow(
    "offline"
  );
  fetchLookup.mockResolvedValue({ status: "unavailable", reason: "no gh" });
  await pullRequestLookup("/repo-b", 1).request;
  expect(fetchLookup).toHaveBeenCalledTimes(2);
});
