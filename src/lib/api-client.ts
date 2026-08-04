"use client";

/**
 * Browser-side GET against the FastAPI backend, authed with the signed-in user's
 * Supabase access token. Used for snappy, on-demand fetches in client components
 * (e.g. the geography state drawer) without a full server re-render. The backend
 * still enforces RBAC, so this exposes nothing a server fetch wouldn't.
 */
import { createClient } from "@/utils/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    /** Backend `error.message` when present, else a generic fallback. */
    message?: string,
  ) {
    super(message ?? `Request failed (${status})`);
    this.name = "ApiClientError";
  }
}

export async function clientGet<T>(path: string): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    cache: "no-store",
  });
  if (!res.ok) throw new ApiClientError(res.status);
  return (await res.json()) as T;
}

/**
 * Browser-side bodyless POST against the FastAPI backend, authed with the
 * signed-in user's Supabase access token. Params ride in the query string (e.g.
 * `?dry_run=false`). Surfaces the backend's `error.message` on a non-2xx so the
 * caller can show WHY it failed (missing config, no recipients, forbidden, ...).
 */
export async function clientPost<T>(path: string): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    cache: "no-store",
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.error?.message === "string") message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(res.status, message);
  }
  // 204 / empty-body responses (e.g. apply/reject) have nothing to parse.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/**
 * Browser-side POST with a JSON body against the FastAPI backend, authed with
 * the signed-in user's Supabase access token. Mirrors `clientPost` (same auth,
 * same `error.message` surfacing, same empty-body handling) but serializes
 * `body` as `application/json` — for endpoints that take a request model in the
 * body rather than query params (e.g. creating a survey schedule).
 */
export async function clientPostJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const errBody = await res.json();
      if (typeof errBody?.error?.message === "string")
        message = errBody.error.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(res.status, message);
  }
  // 204 / empty-body responses have nothing to parse.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// NOTE: there is deliberately no browser-side multipart POST helper here. The
// only caller was the bulk photo import, and posting a batch to the API was the
// bug (#595): Vercel rejects any request body over ~4.5 MB at the edge — for the
// API function just as much as for a Server Action — and that platform error
// carries no CORS headers, so the browser blamed CORS. Bulk photos now upload
// direct-to-storage via signed URLs (see `src/lib/photoImport.ts`); if you need
// to send a large payload, do the same rather than reviving this.
