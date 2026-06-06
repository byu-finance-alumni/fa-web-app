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
  constructor(public status: number) {
    super(`Request failed (${status})`);
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
