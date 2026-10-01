import { expect, it } from "vitest";
import {
  scanFailed,
  scanPending,
  scanSettled,
  type ScannedProject
} from "./scanned-project";

it("classifies every scan state as exactly one of settled, pending or failed", () => {
  const states: [ScannedProject, "settled" | "pending" | "failed"][] = [
    [{ name: "a", path: "/a", records: [] }, "settled"],
    [{ name: "b", path: "/b", error: "boom" }, "failed"],
    [{ name: "c", path: "/c" }, "pending"],
    [{ name: "d", path: "/d", records: [], refreshing: true }, "pending"],
    [{ name: "e", path: "/e", error: "boom", refreshing: true }, "pending"]
  ];
  for (const [project, state] of states) {
    expect({
      settled: scanSettled(project),
      pending: scanPending(project),
      failed: scanFailed(project)
    }).toEqual({
      settled: state === "settled",
      pending: state === "pending",
      failed: state === "failed"
    });
  }
});
