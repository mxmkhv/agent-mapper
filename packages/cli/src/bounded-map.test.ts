import { expect, it } from "vitest";
import { boundedMap } from "./bounded-map";

it("limits concurrent project work while preserving result order", async () => {
  let active = 0;
  let peak = 0;
  const result = await boundedMap(
    Array.from({ length: 30 }, (_, i) => i),
    {
      limit: 4,
      task: async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((finish) => setTimeout(finish, 1));
        active -= 1;
        return item * 2;
      }
    }
  );
  expect(peak).toBe(4);
  expect(result).toEqual(Array.from({ length: 30 }, (_, i) => i * 2));
});
