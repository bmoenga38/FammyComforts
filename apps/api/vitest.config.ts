import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Load the metadata polyfill explicitly so DI metadata never depends on
    // Nest's transitive import order.
    setupFiles: ["reflect-metadata"],
    // Unit specs only for now. E2E + DB integration arrive with the data layer
    // (Story 1.8) and CI (Story 1.9) — see TESTING.md.
    include: ["src/**/*.spec.ts"],
    root: "./",
  },
  // SWC compiles NestJS decorators + emits decorator metadata, which esbuild does not.
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2022",
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
