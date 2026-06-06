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
  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API URL is not configured.");
  return handle<T>(
    await fetch(`${API_URL}${path}`, {
      headers: await authHeaders(),
      cache: "no-store",
    }),
  );
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
