import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards for the public-survey CSP fix (#666).
 *
 * `/survey/[token]` is the only public, unauthenticated page in the app — and it
 * renders alumni PII, accepts edits and takes a photo upload. It was excluded
 * from the middleware matcher outright so the Supabase auth flow wouldn't bounce
 * email-link visitors to /login. That worked, but the nonce-based CSP is built
 * ONLY in middleware, so the exclusion also left that page with no CSP at all.
 *
 * The fix has two halves that can each regress on their own, so both are pinned
 * here:
 *   1. the matcher MATCHES `/survey/*` (otherwise the CSP silently disappears
 *      again), and
 *   2. auth is NOT run on it (otherwise alumni get bounced to /login again).
 * Plus the nonce plumbing, which is what breaks the page if it's wrong.
 */

// Hoisted so the vi.mock factory below (which vitest lifts above the imports)
// can close over it. Auth is mocked out entirely: these tests assert WHETHER it
// runs, not what it does.
const { updateSessionSpy } = vi.hoisted(() => ({ updateSessionSpy: vi.fn() }));
vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: updateSessionSpy,
}));

const { NextRequest, NextResponse } = await import("next/server");
const { config, isNoAuthPath, middleware } = await import("./middleware");

function request(pathname: string): InstanceType<typeof NextRequest> {
  return new NextRequest(new URL(pathname, "https://finance.alumni.byu.edu"));
}

// The matcher is a regex embedded in a path pattern; anchoring it reproduces how
// Next decides whether middleware runs for a pathname.
const matcher = new RegExp(`^${config.matcher[0]}$`);

// Next.js carries the FORWARDED request headers on the response as
// `x-middleware-request-<name>` (listed in `x-middleware-override-headers`) and
// unpacks them before rendering. That is the only place a test can observe the
// nonce that will actually reach the page.
function forwardedHeader(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

function nonceOf(csp: string | null): string | null {
  return csp?.match(/'nonce-([^']+)'/)?.[1] ?? null;
}

beforeEach(() => {
  updateSessionSpy.mockReset();
  updateSessionSpy.mockResolvedValue(NextResponse.next());
});

describe("middleware matcher (#666)", () => {
  it("matches the public survey page, so it gets a CSP", () => {
    expect(matcher.test("/survey/abc123token")).toBe(true);
    expect(matcher.test("/survey/demo")).toBe(true);
  });

  it("does not re-exclude survey/ from the matcher", () => {
    // The literal exclusion is what regressed before; assert it stays gone
    // rather than relying on the regex test alone.
    expect(config.matcher[0]).not.toContain("survey");
  });

  it("still matches ordinary app routes", () => {
    expect(matcher.test("/dashboard")).toBe(true);
    expect(matcher.test("/alumni/42")).toBe(true);
    expect(matcher.test("/login")).toBe(true);
  });

  it("still skips static assets and public metadata files", () => {
    for (const path of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
      "/branding/byu-logo.png",
      "/icon.svg",
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });
});

describe("survey is public: no auth (#666)", () => {
  it("never runs the Supabase auth flow on a survey URL", async () => {
    await middleware(request("/survey/abc123token"));
    expect(updateSessionSpy).not.toHaveBeenCalled();
  });

  it("never redirects a survey visitor to /login", async () => {
    const response = await middleware(request("/survey/abc123token"));
    // A middleware redirect surfaces as a 3xx with a Location header.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still runs auth on protected routes", async () => {
    await middleware(request("/dashboard"));
    expect(updateSessionSpy).toHaveBeenCalledTimes(1);
  });

  it("treats only /survey as auth-free", () => {
    expect(isNoAuthPath("/survey")).toBe(true);
    expect(isNoAuthPath("/survey/abc123token")).toBe(true);
    expect(isNoAuthPath("/dashboard")).toBe(false);
    expect(isNoAuthPath("/login")).toBe(false);
    // Not a prefix match on the raw string — a route merely STARTING with the
    // letters "survey" must not become public.
    expect(isNoAuthPath("/surveys-admin")).toBe(false);
  });
});

describe("survey gets the nonce-based CSP (#666)", () => {
  it("sets the CSP on the response the browser sees", async () => {
    const response = await middleware(request("/survey/abc123token"));
    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    // The whole point of the nonce is that unsafe-inline is gone from scripts.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("forwards a nonce to the page that MATCHES the enforced CSP", async () => {
    // If these two ever diverge, Next.js stamps a nonce the browser refuses and
    // the survey page dies silently for alumni — the main risk of this change.
    const response = await middleware(request("/survey/abc123token"));
    const forwarded = forwardedHeader(response, "x-nonce");
    expect(forwarded).toBeTruthy();
    expect(nonceOf(response.headers.get("content-security-policy"))).toBe(
      forwarded,
    );
  });

  it("issues a fresh nonce per request", async () => {
    const a = await middleware(request("/survey/abc123token"));
    const b = await middleware(request("/survey/abc123token"));
    expect(forwardedHeader(a, "x-nonce")).not.toBe(forwardedHeader(b, "x-nonce"));
  });

  it("keeps a live token URL out of search indexes", async () => {
    const response = await middleware(request("/survey/abc123token"));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("the CSP has exactly one source", () => {
  it("next.config.mjs sets no Content-Security-Policy", () => {
    // Two CSPs = the browser enforces the intersection, which kills the nonce.
    const src = readFileSync(
      resolve(process.cwd(), "next.config.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/key:\s*"Content-Security-Policy"/);
  });
});
