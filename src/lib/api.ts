/**
 * Server-side API client for the FastAPI backend.
 *
 * Calls are made from Server Components with the signed-in user's Supabase
 * access token attached as a Bearer credential. The backend resolves roles
 * from the database, so a 403 means "authenticated but not provisioned".
 */
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Per-field validation detail returned by the backend on a 422 response. */
export type ApiFieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Populated from `error.fields` on 422 validation responses. */
    public fields?: ApiFieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  // Read the token only — never refresh here. Token refresh + cookie rotation
  // happens once per request in the middleware (the one place that can persist
  // the rotated cookies). Calling getUser() here would re-refresh on every
  // server fetch in a Server Component, where the rotated cookie can't be
  // written back; with multiple fetches per request that races the refresh
  // token to a 401. The middleware forwards the refreshed cookies onto the
  // request, so getSession() reads a valid token.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    let fields: ApiFieldError[] | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
      const rawFields = body?.error?.fields;
      if (Array.isArray(rawFields)) {
        fields = rawFields
          .filter(
            (f): f is ApiFieldError =>
              !!f &&
              typeof f.field === "string" &&
              typeof f.message === "string",
          )
          .map((f) => ({ field: f.field, message: f.message }));
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, fields);
  }
  // A 204 No Content (and any other empty body — e.g. DELETE /notes/{id}) has
  // nothing to parse; calling res.json() on it throws a SyntaxError, which is
  // NOT an ApiError, so callers surface their generic fallback ("Couldn't delete
  // the note.") on what was actually a success. Read as text and only parse when
  // there's a body.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : (undefined as T));
}

/** Opt-in Next data-cache settings for slow-changing aggregate GETs. */
export interface ApiCacheOptions {
  /** Seconds to keep the response in the Next data cache. */
  revalidate: number;
  /**
   * Cache tags so mutations can invalidate instantly via `revalidateTag`
   * (e.g. "dashboard", "geography", "events", "audit").
   */
  tags?: string[];
}

/**
 * Server-side GET. Uncached by default (lists/search must be fresh); pass
 * `cacheOpts` only for slow-changing aggregates (dashboard summary, options
 * lists, geography rollups). Note: the Authorization header is part of the
 * fetch cache key, so entries are effectively per-user-session — still a big
 * win for repeat navigation, and it can never leak data across users.
 */
export async function apiGet<T>(
  path: string,
  cacheOpts?: ApiCacheOptions,
): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  return handle<T>(
    await fetch(`${API_URL}${path}`, {
      headers: await authHeaders(),
      ...(cacheOpts
        ? { next: { revalidate: cacheOpts.revalidate, tags: cacheOpts.tags } }
        : { cache: "no-store" as const }),
    }),
  );
}

/**
 * Retry a transient server failure once. Server reads (e.g. the alumni list)
 * can intermittently 5xx on a serverless cold start / a dropped upstream DB
 * connection; a single immediate retry lands on a fresh connection and turns
 * what used to be a hard "Couldn't load" into a transparent success. Only 5xx
 * (and network-level ApiError status 0) are retried — never a 4xx, which is a
 * deterministic client/auth error that a retry can't fix.
 */
export async function apiGetWithRetry<T>(
  path: string,
  cacheOpts?: ApiCacheOptions,
  retries = 1,
): Promise<T> {
  try {
    return await apiGet<T>(path, cacheOpts);
  } catch (e) {
    const transient =
      e instanceof ApiError && (e.status === 0 || e.status >= 500);
    if (transient && retries > 0) {
      return apiGetWithRetry<T>(path, cacheOpts, retries - 1);
    }
    throw e;
  }
}

async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  return handle<T>(
    await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(await authHeaders()),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    }),
  );
}

export const apiPost = <T>(path: string, body: unknown) =>
  apiSend<T>("POST", path, body);
export const apiPatch = <T>(path: string, body: unknown) =>
  apiSend<T>("PATCH", path, body);
export const apiDelete = <T>(path: string) => apiSend<T>("DELETE", path);

/**
 * Server-side multipart POST. Sends the given `FormData` (e.g. a file upload)
 * with the user's Bearer token. We deliberately DON'T set `Content-Type` here —
 * fetch derives the correct `multipart/form-data; boundary=…` header from the
 * FormData body, so forcing it would break the boundary. Used by the CSV import
 * preview/commit endpoints.
 */
export async function apiPostForm<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  return handle<T>(
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: await authHeaders(),
      body: formData,
      cache: "no-store",
    }),
  );
}

/**
 * Server-side GET that returns the raw response body as text (not JSON) — used
 * for file downloads such as the CSV import template, which the client then
 * turns into a Blob download. Auth header is attached like every other call.
 */
export async function apiGetText(path: string): Promise<string> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.text();
}

/**
 * Server-side JSON POST that returns the raw response body as TEXT (not JSON) —
 * used for the alumni CSV export, where the request carries the column + filter
 * selection but the response is a CSV file the client turns into a Blob
 * download. Auth header is attached; an error body's JSON message is surfaced.
 */
export async function apiPostText(path: string, body: unknown): Promise<string> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const errBody = await res.json();
      message = errBody?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.text();
}
