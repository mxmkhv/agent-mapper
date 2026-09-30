import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    setupFiles: ["tests/isolate-git.ts"],
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
