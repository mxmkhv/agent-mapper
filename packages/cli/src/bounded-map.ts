export async function boundedMap<Item, Result>(
  items: readonly Item[],
  options: { limit: number; task(item: Item): Promise<Result> }
): Promise<Result[]> {
  const results: Result[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(options.limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await options.task(items[index]!);
      }
    })
  );
  return results;
}
