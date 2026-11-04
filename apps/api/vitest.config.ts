import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@namma/source'] },
  ssr: { resolve: { conditions: ['@namma/source'] } },
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
