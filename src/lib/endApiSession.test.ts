import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sign-out ends the API session (`POST /auth/logout`) before the Supabase
 * sign-out, best-effort: it sends the current token, never throws, and never
 * waits on a hung API past its timeout.
 */

const getSession = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));

import { endApiSession } from "@/lib/endApiSession";

const fetchMock = vi.fn();

beforeEach(() => {
  getSession.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("endApiSession", () => {
  it("POSTs /auth/logout with the current access token", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValue(new Response('{"ended":true}', { status: 200 }));
    await endApiSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).endsWith("/auth/logout")).toBe(true);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
    expect(init.keepalive).toBe(true);
  });

  it("does nothing without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await endApiSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when the API errors or is unreachable", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    await expect(endApiSession()).resolves.toBeUndefined();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(endApiSession()).resolves.toBeUndefined();
    getSession.mockRejectedValue(new Error("storage"));
    await expect(endApiSession()).resolves.toBeUndefined();
  });

  it("gives up on a hung API after the timeout", async () => {
    vi.useFakeTimers();
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const done = endApiSession(50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(done).resolves.toBeUndefined();
  });
});

// --- wiring: every sign-out path ends the API session first -------------------

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("sign-out wiring", () => {
  it.each([
    "src/components/auth/SignOutButton.tsx",
    "src/components/auth/SessionTimeout.tsx",
    "src/components/auth/SessionGuard.tsx",
  ])("%s calls endApiSession() before auth.signOut()", (file) => {
    const src = read(file);
    const end = src.indexOf("await endApiSession()");
    const out = src.indexOf(".auth.signOut()");
    expect(end).toBeGreaterThan(-1);
    expect(out).toBeGreaterThan(end);
  });
});
