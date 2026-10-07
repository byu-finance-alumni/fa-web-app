import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The headshot image proxy (`/api/headshot/<id>`).
 *
 * A non-editor's photo URL is this app-relative path instead of a signed
 * storage URL, because the storage key — in the signed URL's path AND token —
 * is the alumnus's Net ID, a field hidden from them (2026-10-02 breach test).
 * These pin what the handler may and may not do: only call upstream with a
 * session token, only for a numeric id, only relay an image type, never let an
 * upstream header through, and keep the response out of shared caches.
 */

const apiGetRaw = vi.fn();
vi.mock("@/lib/api", () => ({
  apiGetRaw: (...args: unknown[]) => apiGetRaw(...args),
  apiGet: vi.fn(),
}));

const { GET } = await import("@/app/api/headshot/[id]/route");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("https://app.test/api/headshot/5");

function upstream(
  status: number,
  body: BodyInit | null = null,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

beforeEach(() => {
  apiGetRaw.mockReset();
});

describe("GET /api/headshot/[id]", () => {
  it("streams the image with private caching and nothing from upstream", async () => {
    apiGetRaw.mockResolvedValue(
      upstream(200, new Uint8Array([0xff, 0xd8, 0xff, 0x00]), {
        "content-type": "image/jpeg",
        "x-upstream-secret": "should-not-leak",
        "set-cookie": "a=b",
      }),
    );
    const res = await GET(req(), ctx("5"));
    expect(apiGetRaw).toHaveBeenCalledWith("/alumni/5/headshot/image");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-upstream-secret")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    );
  });

  it("refuses without a session token and never calls upstream anonymously", async () => {
    apiGetRaw.mockResolvedValue(null);
    const res = await GET(req(), ctx("5"));
    expect(res.status).toBe(401);
  });

  it.each(["0", "-1", "abc", "5.0", "5/../../x", "1e3", ""])(
    "404s a non-numeric id (%s) without calling upstream",
    async (id) => {
      const res = await GET(req(), ctx(id));
      expect(res.status).toBe(404);
      expect(apiGetRaw).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403, 404, 429])("passes upstream %s through", async (status) => {
    apiGetRaw.mockResolvedValue(upstream(status, '{"error":{"code":"x"}}'));
    const res = await GET(req(), ctx("5"));
    expect(res.status).toBe(status);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("maps any other upstream failure to 502", async () => {
    apiGetRaw.mockResolvedValue(upstream(500));
    expect((await GET(req(), ctx("5"))).status).toBe(502);
    apiGetRaw.mockRejectedValue(new Error("network down"));
    expect((await GET(req(), ctx("5"))).status).toBe(502);
  });

  it("refuses to relay anything that is not an image type", async () => {
    apiGetRaw.mockResolvedValue(
      upstream(200, "<script>alert(1)</script>", { "content-type": "text/html" }),
    );
    expect((await GET(req(), ctx("5"))).status).toBe(502);
  });
});

describe("headshot proxy wiring", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("runs behind the auth middleware (the matcher covers /api/headshot/*)", () => {
    const src = read("src/proxy.ts");
    const pattern = /"(\/\(\(\?!.*\)\.\*\))",?\s*\n\s*\]/.exec(src)?.[1];
    expect(pattern, "matcher pattern not found").toBeTruthy();
    // Next matchers are path-to-regexp; this one is a plain regex group.
    const re = new RegExp(`^${pattern!.replace(/\\\\/g, "\\")}$`);
    expect(re.test("/api/headshot/5")).toBe(true);
    // ...and it is not a public path.
    expect(read("src/utils/supabase/middleware.ts")).not.toMatch(
      /PUBLIC_PATHS = \[[^\]]*\/api/,
    );
  });

  it("is reachable under the CSP: same origin, no new img-src host", () => {
    expect(read("src/lib/csp.ts")).toContain("img-src 'self'");
  });
});
