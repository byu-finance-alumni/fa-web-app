import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Minimal unit-test config. Tests run in Node (the suites are pure logic +
// source-invariant guards — no DOM needed) and live next to the code they cover
// as `*.test.ts`.
export default defineConfig({
  // Mirror the `@/*` → `src/*` path alias from tsconfig.json, so a suite can
  // cover modules that import through it (vite does not read tsconfig paths).
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Next compiles JSX with the automatic runtime (no `React` in scope), so a
  // suite that renders a `.tsx` component through react-dom/server needs the
  // same transform here — esbuild's default is the classic `React.createElement`.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
