import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // PDF rendering and bcrypt tests are slower on some Windows machines.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
