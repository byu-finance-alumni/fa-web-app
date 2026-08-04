import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards for the headshot request-reduction work.
 *
 * The prod storage logs showed the SAME alumnus being signed ~5× in a 1,000-row
 * sample, because the roster minted one signed URL per visible row on every
 * render and cached none of them. These pin the three properties that fixed it:
 * one request per page, a stable (deduplicated + sorted) request URL so repeat
 * renders hit the data cache, and a TTL that stays well inside the signature's
 * own one-hour lifetime.
 */

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({ apiGet: (...args: unknown[]) => apiGet(...args) }));

const { getHeadshotUrls, HEADSHOT_CACHE_SECONDS, HEADSHOT_CACHE_TAG } =
  await import("./headshots");

/** The backend signs for one hour (`expires_in=3600` in supabase_storage.py). */
const SIGNED_URL_LIFETIME_SECONDS = 3600;

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/** Query string of the nth apiGet call. */
function queryOf(call: number): URLSearchParams {
  const path = apiGet.mock.calls[call][0] as string;
  return new URLSearchParams(path.slice(path.indexOf("?") + 1));
}

beforeEach(() => {
  apiGet.mockReset();
});

describe("getHeadshotUrls", () => {
  it("asks for a whole page in ONE request, not one per row", async () => {
    apiGet.mockResolvedValue({ urls: {} });
    await getHeadshotUrls([11, 12, 13, 14, 15]);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet.mock.calls[0][0]).toContain("/alumni/headshots/urls?");
  });

  it("deduplicates repeated ids so one alumnus is never signed twice", async () => {
    apiGet.mockResolvedValue({ urls: {} });
    await getHeadshotUrls([7, 7, 7, 7, 7]);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(queryOf(0).getAll("alumni_ids")).toEqual(["7"]);
  });

  it("sorts the ids, so the same rows always produce the same cache key", async () => {
    apiGet.mockResolvedValue({ urls: {} });
    await getHeadshotUrls([30, 10, 20]);
    await getHeadshotUrls([20, 30, 10]);
    // Different row order, identical request URL -> the second render is a
    // cache HIT rather than a fresh round of signatures.
    expect(apiGet.mock.calls[0][0]).toBe(apiGet.mock.calls[1][0]);
    expect(queryOf(0).getAll("alumni_ids")).toEqual(["10", "20", "30"]);
  });

  it("caches the response, tagged so a photo change can bust it", async () => {
    apiGet.mockResolvedValue({ urls: {} });
    await getHeadshotUrls([1]);
    expect(apiGet.mock.calls[0][1]).toEqual({
      revalidate: HEADSHOT_CACHE_SECONDS,
      tags: [HEADSHOT_CACHE_TAG],
    });
  });

  it("keeps the cache window far inside the signed URL's lifetime", () => {
    // A cached URL must still have plenty of validity left when it is served,
    // otherwise the browser gets an expired signature and shows initials. The
    // answer to wanting a longer cache is never a longer signature.
    expect(HEADSHOT_CACHE_SECONDS).toBeLessThan(SIGNED_URL_LIFETIME_SECONDS / 2);
  });

  it("answers every requested id, with null for anyone who has no photo", async () => {
    apiGet.mockResolvedValue({ urls: { "1": "https://storage/sign/a", "2": null } });
    const urls = await getHeadshotUrls([1, 2, 3]);
    expect(urls).toEqual({ 1: "https://storage/sign/a", 2: null, 3: null });
  });

  it("falls back to initials instead of throwing when the lookup fails", async () => {
    apiGet.mockRejectedValue(new Error("api down"));
    await expect(getHeadshotUrls([1, 2])).resolves.toEqual({ 1: null, 2: null });
  });

  it("makes no request at all for an empty page", async () => {
    await expect(getHeadshotUrls([])).resolves.toEqual({});
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("chunks a batch larger than the backend's per-request cap", async () => {
    apiGet.mockResolvedValue({ urls: {} });
    await getHeadshotUrls(Array.from({ length: 150 }, (_, i) => i + 1));
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(queryOf(0).getAll("alumni_ids")).toHaveLength(100);
    expect(queryOf(1).getAll("alumni_ids")).toHaveLength(50);
  });
});

describe("headshot request-reduction invariants", () => {
  it("the roster no longer fans out one headshot request per row", () => {
    const src = read("src/components/alumni/AlumniRoster.tsx");
    expect(src).toContain("getHeadshotUrls(");
    // The old shape: a per-item map over `/alumni/${…}/headshot`.
    expect(src).not.toMatch(/\/headshot`\)/);
  });

  it("every photo mutation invalidates the cached signed URLs", () => {
    const src = read("src/app/(app)/alumni/actions.ts");
    // upload (multipart), direct-upload confirm, bulk-import confirm, delete.
    expect(src.match(/revalidateTag\(HEADSHOT_CACHE_TAG\)/g) ?? []).toHaveLength(4);
  });

  it("the post-upload refresh stays UNCACHED so a new photo shows at once", () => {
    const src = read("src/app/(app)/alumni/actions.ts");
    const start = src.indexOf("export async function getHeadshotUrl(");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf("\n}", start));
    // It re-reads the single-headshot route immediately after a photo was
    // replaced, so it must pass no cache options at all.
    expect(body).toContain("/headshot`");
    expect(body).not.toContain("revalidate");
    expect(body).not.toContain(HEADSHOT_CACHE_TAG);
  });
});
