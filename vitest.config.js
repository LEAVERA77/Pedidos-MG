import { defineConfig } from "vitest/config";

/** Solo front estático (map.js, offline.js, integridad). La API corre con `npm run test:api`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    pool: "forks",
    fileParallelism: false,
  },
});
