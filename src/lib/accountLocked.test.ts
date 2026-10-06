import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_LOCKED_CODE,
  errorCodeOf,
  isAccountLocked,
} from "@/lib/accountLocked";

/**
 * Hard-locked accounts (403 / `account_locked` on every authenticated route).
 *
 * Two places must turn that answer into "signed out": the login server action
 * (Supabase accepted the password, then `POST /auth/login` refused) and the
 * app-shell SessionGuard (an already-signed-in device whose account gets
 * locked). Both are covered here — the action by running it against mocked
 * Next/Supabase/fetch, the guard by its pure decision plus the client fetch
 * that feeds it, and a source guard on the wiring.
 */

const LOCKOUT_MESSAGE =
  "Too many failed attempts. Please wait a few minutes and try again, or contact an administrator if you remain locked out.";

// --- the pure decision ------------------------------------------------------

describe("isAccountLocked / errorCodeOf", () => {
  it("is true only for a 403 carrying the account_locked code", () => {
    expect(isAccountLocked(403, ACCOUNT_LOCKED_CODE)).toBe(true);
    expect(isAccountLocked(403, "forbidden")).toBe(false);
    expect(isAccountLocked(403, null)).toBe(false);
    expect(isAccountLocked(401, ACCOUNT_LOCKED_CODE)).toBe(false);
    expect(isAccountLocked(503, ACCOUNT_LOCKED_CODE)).toBe(false);
  });

  it("reads error.code defensively", () => {
    expect(errorCodeOf({ error: { code: "account_locked", message: "x" } })).toBe(
      "account_locked",
    );
    expect(errorCodeOf({ error: { code: 7 } })).toBeNull();
    expect(errorCodeOf({ error: "nope" })).toBeNull();
    expect(errorCodeOf(null)).toBeNull();
    expect(errorCodeOf("text")).toBeNull();
  });
});

// --- the login server action ----------------------------------------------

const signOut = vi.fn();
const signInWithPassword = vi.fn();
const getSession = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  RedirectType: { replace: "replace", push: "push" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { signInWithPassword, getSession, signOut },
  }),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "tok" } } }),
    },
  }),
}));

const { signIn } = await import("@/app/login/actions");
const { ApiClientError, clientGet } = await import("@/lib/api-client");

/** fetch stub: precheck allows, record is fine, /auth/login answers `login`. */
function stubFetch(login: { status: number; body?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/auth/login/precheck")) {
        return new Response(JSON.stringify({ allowed: true }), { status: 200 });
      }
      if (url.endsWith("/auth/login/record")) {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/auth/login")) {
        return new Response(
          login.body === undefined ? null : JSON.stringify(login.body),
          { status: login.status },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

describe("signIn — a hard-locked account", () => {
  const OLD_URL = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.test";
    signOut.mockReset();
    redirect.mockClear();
    signInWithPassword.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = OLD_URL;
    vi.unstubAllGlobals();
  });

  it("signs back out and returns the generic lockout message", async () => {
    stubFetch({
      status: 403,
      body: { error: { code: "account_locked", message: "Account locked: admin note" } },
    });
    const result = await signIn("someone@byu.edu", "pw");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: LOCKOUT_MESSAGE });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still handles maintenance the same way", async () => {
    stubFetch({
      status: 503,
      body: { error: { code: "maintenance_mode", message: "Back at 5." } },
    });
    const result = await signIn("someone@byu.edu", "pw");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: "Back at 5." });
  });

  it("an ordinary 403 stays fail-open (no sign-out, login proceeds)", async () => {
    stubFetch({ status: 403, body: { error: { code: "forbidden" } } });
    await expect(signIn("someone@byu.edu", "pw")).rejects.toThrow("NEXT_REDIRECT");
    expect(signOut).not.toHaveBeenCalled();
  });
});

// --- SessionGuard -----------------------------------------------------------

describe("SessionGuard — a hard-locked account", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clientGet surfaces the backend error code the guard branches on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "account_locked", message: "m" } }),
            { status: 403 },
          ),
      ),
    );
    const err = (await clientGet("/auth/session/active").catch(
      (e: unknown) => e,
    )) as InstanceType<typeof ApiClientError>;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("account_locked");
    expect(isAccountLocked(err.status, err.code)).toBe(true);
  });

  it("clientGet tolerates a non-JSON error body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    const err = (await clientGet("/x").catch((e: unknown) => e)) as InstanceType<
      typeof ApiClientError
    >;
    expect(err.status).toBe(500);
    expect(err.code).toBeNull();
  });

  it("signs out and goes to /login on account_locked", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/auth/SessionGuard.tsx"),
      "utf8",
    );
    const branch = src.slice(src.indexOf("isAccountLocked(e.status, e.code)"));
    expect(branch).not.toBe(src);
    expect(branch.slice(0, 400)).toContain('signOutTo("/login")');
    // signOutTo really signs out before navigating.
    const helper = src.slice(src.indexOf("async function signOutTo"));
    expect(helper.indexOf(".auth.signOut()")).toBeGreaterThan(-1);
    expect(helper.indexOf(".auth.signOut()")).toBeLessThan(
      helper.indexOf("router.replace(path)"),
    );
  });
});
