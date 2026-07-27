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
  return (await res.json()) as T;
}

/**
 * Browser-side multipart POST against the FastAPI backend, authed with the
 * signed-in user's Supabase access token.
 *
 * Uploads go straight to the backend (not through a Next.js Server Action) on
 * purpose: a large multipart body — the bulk headshot import accepts up to
 * 1000 files / 200 MB — would blow the ~4.5 MB serverless request-body cap if
 * it were routed through a Server Action. `Content-Type` is intentionally NOT
 * set so the browser derives the correct `multipart/form-data; boundary=…`.
 * On a non-2xx the backend's `error.message` (when present) is surfaced.
 */
export async function clientPostForm<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
    body: formData,
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
  return (await res.json()) as T;
}
