import { expect, it } from "vitest";
import { copyTargets } from "./copy-targets";

it("lists projects, their available worktrees and a folder added by hand", () => {
  const targets = copyTargets(
    [
      {
        path: "/work/shop",
        hits: [],
        worktrees: [
          { path: "/work/shop", isMain: true, state: "available" },
          {
            path: "/work/shop-fix",
            isMain: false,
            state: "available",
            branch: "fix/cart"
          },
          { path: "/work/shop-old", isMain: false, state: "prunable" }
        ]
      }
    ],
    "/elsewhere/notes"
  );
  expect(targets).toEqual([
    { path: "/work/shop", label: "shop" },
    { path: "/work/shop-fix", label: "shop · fix/cart" },
    { path: "/elsewhere/notes", label: "notes" }
  ]);
  expect(copyTargets([], undefined)).toEqual([]);
  expect(
    copyTargets(
      targets.map(({ path }) => ({ path, hits: [] })),
      "/work/shop"
    )
  ).toHaveLength(3);
});
