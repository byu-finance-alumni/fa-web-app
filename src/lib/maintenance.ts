/**
 * The site-wide maintenance switch, read from the backend's PUBLIC status
 * endpoint.
 *
 * Deliberately a bare `fetch` rather than `apiGet`: this has to work for a
 * logged-out visitor and must not depend on the Supabase client, the cookie
 * store, or a valid session — the whole point is that it still answers when the
 * user has no way in. `GET /maintenance/status` is unauthenticated and returns
 * only `{ enabled, message }`.
 *
 * FAILS OPEN, everywhere. Every error path — network failure, non-OK response,
 * unparseable body, missing field — resolves to "not in maintenance". A control
 * that can hide the entire application from every user must never be triggered
 * by a failure to read it; the worst case has to be "the site stays up", not
 * "the site disappears". The backend gate makes the same choice, so the two
 * cannot disagree in the dangerous direction.
 */

export type MaintenanceStatus = {
  enabled: boolean;
  /** Public copy for the maintenance page. Never contains internal detail. */
  message: string | null;
};

const OFF: MaintenanceStatus = { enabled: false, message: null };

/** Shown if the backend is unreachable but we somehow still render the page. */
export const FALLBACK_MESSAGE =
  "The site is temporarily unavailable. Please check back soon.";

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return OFF;
  try {
    const res = await fetch(`${base}/maintenance/status`, {
      // Never cached: turning maintenance OFF has to be felt on the next
      // navigation, or users stay stranded on the maintenance page. The backend
      // serves this from a short in-process cache, so it is cheap to ask.
      cache: "no-store",
    });
    if (!res.ok) return OFF;
    const data: unknown = await res.json();
    const body = data as { enabled?: unknown; message?: unknown } | null;
    // Only an EXPLICIT true enables. A garbled/missing field fails open.
    if (body?.enabled !== true) return OFF;
    return {
      enabled: true,
      message: typeof body.message === "string" && body.message.trim()
        ? body.message
        : null,
    };
  } catch {
    return OFF;
  }
}
