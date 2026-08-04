/**
 * Server-side headshot URL reads — the ONE place the app asks the backend for
 * signed photo URLs while rendering.
 *
 * Headshots live in a PRIVATE bucket, so every photo needs a short-lived signed
 * URL minted by the backend (which in turn costs a Supabase Storage round-trip).
 * Two properties keep that cost proportional to the number of DISTINCT alumni on
 * screen rather than to the number of renders:
 *
 * 1. **One request per page, not one per row.** The roster used to call
 *    `GET /alumni/{id}/headshot` once per visible row — 25 API invocations and
 *    25 single-row queries to draw one table. {@link getHeadshotUrls} asks the
 *    batch route (`GET /alumni/headshots/urls`) once, with the ids deduplicated
 *    and SORTED so the same visible page always produces the same URL (and so
 *    the same cache entry).
 * 2. **The answer is cached for a slice of the signed URL's own lifetime.** The
 *    URLs the backend mints last an hour and are re-usable until then, so
 *    re-minting them on every render was pure waste: the same alumni were being
 *    signed over and over as the roster re-rendered. Caching for
 *    {@link HEADSHOT_CACHE_SECONDS} keeps every URL handed to a browser at least
 *    ~50 minutes short of expiry while collapsing repeat renders to one call.
 *
 * Nothing here widens access: the bucket stays private, the URLs stay
 * short-lived, and a null result still renders the initials fallback. The Next
 * data cache is keyed by URL *and* request headers (so entries are effectively
 * per-session) — and a headshot URL is readable by every authenticated view
 * role anyway, so an entry can never expose a photo to someone who couldn't ask
 * for it themselves.
 *
 * A photo CHANGE (upload / replace / remove / bulk import) invalidates
 * {@link HEADSHOT_CACHE_TAG}, so a new picture never waits out the TTL.
 */

import { apiGet, type ApiCacheOptions } from "@/lib/api";

/**
 * Cache tag carried by every cached headshot read. Photo mutations call
 * `revalidateTag(HEADSHOT_CACHE_TAG)` so the change is visible on the very next
 * render instead of after the TTL.
 */
export const HEADSHOT_CACHE_TAG = "alumni-headshots";

/**
 * How long a minted signed URL may be re-served from the Next data cache.
 *
 * The backend signs for one hour (`expires_in=3600`), so at 10 minutes the
 * oldest URL a browser can receive still has ~50 minutes of validity — a wide
 * margin, deliberately. Raising this toward the hour would start handing out
 * URLs that expire mid-page; the fix for wanting a longer cache is NOT to
 * lengthen the signature.
 */
export const HEADSHOT_CACHE_SECONDS = 600;

/**
 * Ids per batch request. Mirrors the backend's own per-request cap
 * (`_HEADSHOT_BATCH_MAX`); the roster only ever asks for a page (25), so this is
 * a guard rather than a routine code path.
 */
const MAX_IDS_PER_REQUEST = 100;

const CACHE_OPTS: ApiCacheOptions = {
  revalidate: HEADSHOT_CACHE_SECONDS,
  tags: [HEADSHOT_CACHE_TAG],
};

/** Batch response shape: `{ urls: { "<alumni_id>": "<signed url>" | null } }`. */
type HeadshotUrlsResponse = { urls?: Record<string, string | null> | null };

/**
 * Signed headshot URLs for a set of alumni, keyed by `alumni_id`.
 *
 * Every id passed in is present in the result; `null` means "no photo to show"
 * (no net ID, nothing uploaded, or the lookup failed) and the caller renders the
 * initials avatar. Photos are decoration — a failure here must never take a
 * roster down, so errors resolve to nulls rather than throwing.
 */
export async function getHeadshotUrls(
  alumniIds: readonly number[],
): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};
  for (const id of alumniIds) result[id] = null;

  // Deduplicate (the same alumnus must never be signed twice for one page) and
  // sort, so a stable set of rows always yields the same request URL — which is
  // what lets the data cache hit across re-renders and re-navigations.
  const ids = Array.from(new Set(alumniIds))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
  if (ids.length === 0) return result;

  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    batches.push(ids.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  const responses = await Promise.allSettled(
    batches.map((batch) => {
      const params = new URLSearchParams();
      for (const id of batch) params.append("alumni_ids", String(id));
      return apiGet<HeadshotUrlsResponse>(
        `/alumni/headshots/urls?${params.toString()}`,
        CACHE_OPTS,
      );
    }),
  );

  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    for (const [key, url] of Object.entries(response.value?.urls ?? {})) {
      const id = Number(key);
      if (Number.isInteger(id)) result[id] = url ?? null;
    }
  }
  return result;
}

/**
 * The signed headshot URL for a single alumnus (the profile header), or `null`
 * when there is no photo to show. Cached on the same terms as the batch read, so
 * revisiting a profile doesn't re-mint a URL that is still perfectly valid.
 *
 * This is the RENDER path. The post-upload refresh in `ProfileHeadshot` goes
 * through the uncached `getHeadshotUrl` server action instead, so a photo that
 * was just saved is never served from cache.
 */
export async function fetchHeadshotUrl(
  alumniId: number,
): Promise<string | null> {
  try {
    const res = await apiGet<{ url: string | null }>(
      `/alumni/${alumniId}/headshot`,
      CACHE_OPTS,
    );
    return res?.url ?? null;
  } catch {
    // No headshot / endpoint error — the initials fallback is shown.
    return null;
  }
}
