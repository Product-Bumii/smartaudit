import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    // Each file starts its own in-memory MongoDB replica set; run files sequentially.
    fileParallelism: false,
  },
});
