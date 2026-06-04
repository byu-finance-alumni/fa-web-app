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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

export async function apiGet<T>(path: string): Promise<T> {
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
  return (await res.json()) as T;
}
