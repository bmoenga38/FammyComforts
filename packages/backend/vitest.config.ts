import { defineConfig } from "vitest/config";

// convex-test runs Convex functions in an edge-like runtime; it requires the
// `edge-runtime` environment and that convex-test is inlined for transform.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
