/**
 * Headshot image proxy for viewers who may not see Net IDs.
 *
 * A headshot is stored under the alumnus's Net ID, and a signed storage URL
 * carries that key in its path and its token. Net ID is hidden from anyone who
 * can't edit alumni (view_only), so for them the backend's headshot URL routes
 * return THIS path (`/api/headshot/<alumni_id>`) instead of a signed URL. The
 * browser only ever sees our own origin (`img-src 'self'`); this handler fetches
 * the bytes from `GET /alumni/{id}/headshot/image` with the viewer's own token —
 * so the backend applies their access rules and read budget — and streams them
 * back. Editors still get direct signed URLs and never come through here, which
 * keeps the egress and function cost to the accounts that need it.
 *
 * Not usable unauthenticated: the middleware matcher covers `/api/*` (an
 * anonymous request is redirected to /login before it gets here), and this
 * handler independently refuses to call upstream without a session token.
 */
import { apiGetRaw } from "@/lib/api";
import { HEADSHOT_CACHE_SECONDS } from "@/lib/headshots";

// Per-viewer, authenticated content: never prerender, never share a cache.
export const dynamic = "force-dynamic";

/** The only types the backend serves (sniffed from the bytes upstream). */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Positive integer id, as the backend's `IdPath` accepts — nothing else is
 *  ever interpolated into the upstream path. */
const ID_PATTERN = /^[1-9]\d{0,17}$/;

/** Upstream statuses passed through as-is; anything else becomes a 502. */
const PASS_THROUGH = new Set([401, 403, 404, 429]);

function empty(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return empty(404);

  let upstream: Response | null;
  try {
    upstream = await apiGetRaw(`/alumni/${id}/headshot/image`);
  } catch {
    return empty(502);
  }
  if (upstream === null) return empty(401);
  if (!upstream.ok) {
    return empty(PASS_THROUGH.has(upstream.status) ? upstream.status : 502);
  }

  const type = (upstream.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!IMAGE_TYPES.has(type)) return empty(502);

  // Only these headers go back — never the upstream's own, so nothing about
  // the API host or storage can ride along.
  const headers = new Headers({
    "Content-Type": type,
    // PRIVATE: per-viewer content must never sit in a shared (CDN) cache. The
    // max-age matches the 10-minute signed-URL cache an editor's photos get.
    "Cache-Control": `private, max-age=${HEADSHOT_CACHE_SECONDS}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });
  return new Response(upstream.body, { status: 200, headers });
}
