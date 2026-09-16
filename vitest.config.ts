import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Minimal unit-test config. Tests run in Node (the suites are pure logic +
// source-invariant guards, plus a few that render a component to static HTML
// with react-dom/server — still no DOM) and live next to the code they cover
// as `*.test.ts`.
export default defineConfig({
  // Next compiles JSX with the automatic runtime (no `import React`), so a
  // suite that renders a .tsx component needs esbuild told the same.
  esbuild: { jsx: "automatic" },
  // Mirror the `@/*` → `src/*` path alias from tsconfig.json, so a suite can
  // cover modules that import through it (vite does not read tsconfig paths).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
