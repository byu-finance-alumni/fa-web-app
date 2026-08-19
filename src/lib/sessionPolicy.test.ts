import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_OPTIONS,
  boundCookieMaxAge,
  parseCookieHeader,
  serializeCookie,
} from "./sessionPolicy";

const SUPABASE_DEFAULT_MAX_AGE = 400 * 24 * 60 * 60;

describe("session cookie lifetime (#684)", () => {
  it("is 12 hours", () => {
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(12 * 60 * 60);
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBe(43_200);
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(SESSION_COOKIE_MAX_AGE_SECONDS);
  });

  it("is dramatically shorter than the @supabase/ssr default it replaces", () => {
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBeLessThan(
      SUPABASE_DEFAULT_MAX_AGE,
    );
  });
});

describe("boundCookieMaxAge", () => {
  it("caps the library's 400-day default at 12 hours", () => {
    expect(boundCookieMaxAge({ maxAge: SUPABASE_DEFAULT_MAX_AGE })).toEqual({
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("applies the cap when no maxAge was given at all", () => {
    const noLifetime: { path: string; sameSite: "lax"; maxAge?: number } = {
      path: "/",
      sameSite: "lax",
    };
    expect(boundCookieMaxAge(noLifetime)).toEqual({
      path: "/",
      sameSite: "lax",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("leaves a SHORTER lifetime alone — it only ever tightens", () => {
    expect(boundCookieMaxAge({ maxAge: 60 })).toEqual({ maxAge: 60 });
  });

  it("passes deletions through untouched", () => {
    // maxAge 0 is how the SDK expires stale cookie chunks. Clamping one up to
    // 12h would resurrect a cookie it is trying to remove.
    const del = { maxAge: 0, path: "/" };
    expect(boundCookieMaxAge(del)).toBe(del);
    const negative = { maxAge: -1 };
    expect(boundCookieMaxAge(negative)).toBe(negative);
  });

  it("preserves every other attribute, including httpOnly and sameSite", () => {
    const out = boundCookieMaxAge({
      path: "/",
      sameSite: "lax" as const,
      httpOnly: false,
      secure: true,
      maxAge: SUPABASE_DEFAULT_MAX_AGE,
    });
    expect(out).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: true,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("drops an Expires that would outlive the cap", () => {
    const out = boundCookieMaxAge({
      maxAge: SUPABASE_DEFAULT_MAX_AGE,
      expires: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
    });
    expect(out.maxAge).toBe(SESSION_COOKIE_MAX_AGE_SECONDS);
    expect(out.expires).toBeUndefined();
  });

  it("keeps an Expires that is already inside the cap", () => {
    const soon = new Date(Date.now() + 60_000);
    const out = boundCookieMaxAge({ maxAge: 120, expires: soon });
    expect(out.expires).toBe(soon);
  });

  it("does not mutate its input", () => {
    const input = { maxAge: SUPABASE_DEFAULT_MAX_AGE, path: "/" };
    boundCookieMaxAge(input);
    expect(input.maxAge).toBe(SUPABASE_DEFAULT_MAX_AGE);
  });

  it("is idempotent", () => {
    const once = boundCookieMaxAge({ maxAge: SUPABASE_DEFAULT_MAX_AGE });
    expect(boundCookieMaxAge(once)).toEqual(once);
  });
});

describe("browser cookie jar helpers", () => {
  it("parses a document.cookie string", () => {
    expect(parseCookieHeader("a=1; b=two; c=")).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "two" },
      { name: "c", value: "" },
    ]);
  });

  it("handles empty / absent headers", () => {
    expect(parseCookieHeader("")).toEqual([]);
    expect(parseCookieHeader(null)).toEqual([]);
    expect(parseCookieHeader(undefined)).toEqual([]);
    expect(parseCookieHeader("  ;  ; ")).toEqual([]);
  });

  it("URI-decodes values and survives a malformed escape", () => {
    expect(parseCookieHeader("x=a%20b")).toEqual([{ name: "x", value: "a b" }]);
    expect(parseCookieHeader("x=100%")).toEqual([{ name: "x", value: "100%" }]);
  });

  it("keeps the first occurrence of a duplicated name", () => {
    expect(parseCookieHeader("k=first; k=second")).toEqual([
      { name: "k", value: "first" },
    ]);
  });

  it("round-trips the chunked base64url values Supabase actually writes", () => {
    const name = "sb-abcdefgh-auth-token.0";
    const value = "base64-eyJhY2Nlc3NfdG9rZW4iOiJ4LXktei0xMjMifQ";
    const serialized = serializeCookie(name, value, { path: "/" });
    expect(parseCookieHeader(serialized.split(";")[0])).toEqual([
      { name, value },
    ]);
  });

  it("emits the bounded Max-Age and the standard attributes", () => {
    const out = serializeCookie("sb-x-auth-token", "v", {
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
    expect(out).toContain(`Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
    expect(out).toContain("Path=/");
    expect(out).toContain("SameSite=Lax");
    expect(out).toContain("Secure");
  });

  it("never emits HttpOnly — document.cookie cannot set it and the client must read the cookie", () => {
    const out = serializeCookie("k", "v", { httpOnly: true, path: "/" });
    expect(out.toLowerCase()).not.toContain("httponly");
  });

  it("emits Max-Age=0 verbatim for a deletion", () => {
    const out = serializeCookie("k", "", boundCookieMaxAge({ maxAge: 0 }));
    expect(out).toContain("Max-Age=0");
  });

  it("defaults Path to / so a cookie set on a deep route still covers the app", () => {
    expect(serializeCookie("k", "v")).toContain("Path=/");
  });
});

/**
 * Source-level guards: all three Supabase client factories must apply the SAME
 * bound. If only some of them do, the ones that don't silently reset the
 * lifetime back to 400 days on the next write — the middleware especially,
 * since it rewrites cookies on every matched request.
 */
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/**
 * The file with comments stripped. These modules explain the 400-day default
 * and the `maxAge: 0` deletion case in prose, and a guard against hard-coded
 * numbers should read the CODE, not the explanation of why the code is that
 * way.
 */
function codeOnly(relPath: string): string {
  return read(relPath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("all three Supabase client factories share one lifetime (#684)", () => {
  const factories = [
    "src/utils/supabase/client.ts",
    "src/utils/supabase/server.ts",
    "src/utils/supabase/middleware.ts",
  ];

  it.each(factories)("%s imports the shared constant", (path) => {
    const src = read(path);
    expect(src).toContain("@/lib/sessionPolicy");
    expect(src).toContain("SESSION_COOKIE_OPTIONS");
  });

  it.each(factories)("%s bounds every cookie it writes", (path) => {
    expect(read(path)).toContain("boundCookieMaxAge(options)");
  });

  it.each(factories)("%s hard-codes no lifetime of its own", (path) => {
    // The value lives in ONE place. A literal here is drift waiting to happen.
    expect(codeOnly(path)).not.toMatch(/maxAge:\s*\d/);
  });

  it("no factory flips httpOnly — the browser client must be able to read the cookie", () => {
    for (const path of factories) {
      expect(codeOnly(path)).not.toMatch(/httpOnly:\s*true/);
    }
  });
});
