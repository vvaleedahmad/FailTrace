export const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) => {
  const results: R[] = [];
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );

  return results;
};
