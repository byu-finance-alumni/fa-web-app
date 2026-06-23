import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-invariant guards for the back-button-logout fix (issue #31).
 *
 * The original (2026-06-09) bug was calling `getUser()` inside a Server
 * Component / server fetch helper. `getUser()` triggers a token refresh, but a
 * Server Component can't persist the rotated cookie — so the browser was left
 * holding an already-used refresh token and got bounced to /login on the next
 * navigation (notably Back after idle). The fix swapped those call sites to the
 * read-only `getSession()`, trusting the middleware (the one place that CAN
 * write rotated cookies) to refresh once per request.
 *
 * These tests fail if anyone reintroduces `getUser()` into those server files,
 * or removes the prefetch skip from the middleware — encoding the fix so it
 * can't silently regress. They read source text rather than executing the Next
 * runtime, which is the right altitude for a structural invariant like this.
 */
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("session handling invariants (#31)", () => {
  // Match the qualified CALL form (`.auth.getUser(`) so the many explanatory
  // comments that mention "getUser()" by name don't trip these guards.
  it("the (app) layout uses getSession(), never getUser()", () => {
    const src = read("src/app/(app)/layout.tsx");
    expect(src).toContain(".auth.getSession(");
    expect(src).not.toContain(".auth.getUser(");
  });

  it("the server API client reads the token with getSession(), never getUser()", () => {
    const src = read("src/lib/api.ts");
    expect(src).toContain(".auth.getSession(");
    expect(src).not.toContain(".auth.getUser(");
  });

  it("the middleware still skips auth for prefetch requests", () => {
    const src = read("src/middleware.ts");
    // The prefetch skip must remain wired (delegates to isPrefetchHeaders).
    expect(src).toContain("isPrefetch");
    expect(src).toMatch(/if \(isPrefetch\(request\)\)/);
  });

  it("the Supabase middleware helper is the one place that calls getUser()", () => {
    // getUser() IS correct in the middleware helper — it can write rotated
    // cookies back onto the response. This asserts the refresh still lives there.
    const src = read("src/utils/supabase/middleware.ts");
    expect(src).toContain(".auth.getUser(");
  });
});
