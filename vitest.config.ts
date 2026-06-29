import { defineConfig } from "vitest/config";

// Minimal unit-test config. Tests run in Node (the suites are pure logic +
// source-invariant guards — no DOM needed) and live next to the code they cover
// as `*.test.ts`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
