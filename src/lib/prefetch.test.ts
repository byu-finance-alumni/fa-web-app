import { describe, expect, it } from "vitest";
import { isPrefetchHeaders } from "./prefetch";

/**
 * Regression guard for the back-button-logout fix (issue #31).
 *
 * The defense-in-depth half of the fix skips the Supabase token refresh +
 * redirect in the middleware for PREFETCH requests, so a `<Link>` prefetch near
 * token expiry can't rotate the single-use refresh token out from under the
 * browser (→ `refresh_token_already_used` on the next real navigation) or cache
 * a `/login` redirect a later Back press lands on. These assert the three
 * prefetch signals are detected and that a real navigation is not misclassified.
 */
function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("isPrefetchHeaders", () => {
  it("detects a Next.js App Router <Link> prefetch", () => {
    // Next sends the header with a value of "1"; any present value counts.
    expect(isPrefetchHeaders(headers({ "next-router-prefetch": "1" }))).toBe(true);
  });

  it("detects a browser speculative fetch via purpose: prefetch", () => {
    expect(isPrefetchHeaders(headers({ purpose: "prefetch" }))).toBe(true);
  });

  it("detects a browser speculative fetch via sec-purpose", () => {
    expect(isPrefetchHeaders(headers({ "sec-purpose": "prefetch" }))).toBe(true);
    // The spec allows compound values like "prefetch;prerender".
    expect(
      isPrefetchHeaders(headers({ "sec-purpose": "prefetch;prerender" })),
    ).toBe(true);
  });

  it("does NOT classify a real navigation as a prefetch", () => {
    expect(isPrefetchHeaders(headers({}))).toBe(false);
    expect(
      isPrefetchHeaders(
        headers({ accept: "text/html", "user-agent": "Mozilla/5.0" }),
      ),
    ).toBe(false);
  });

  it("does NOT treat a non-prefetch purpose value as a prefetch", () => {
    expect(isPrefetchHeaders(headers({ purpose: "navigate" }))).toBe(false);
    expect(isPrefetchHeaders(headers({ "sec-purpose": "prerender" }))).toBe(false);
  });
});
