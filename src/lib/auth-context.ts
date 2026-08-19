import { cache } from "react";
import { ApiError, apiGetWithRetry } from "@/lib/api";
import { isPermissionAnswer } from "@/lib/loadError";
import type { UserContext } from "@/types/alumni";

/**
 * The signed-in user's `/auth/context` (identity, roles, capabilities), fetched
 * at most once per request.
 *
 * The `(app)` layout needs it for role-aware nav, and several pages under it
 * (dashboard, alumni/friends roster, users admin, engineer logins, import gate)
 * each need it too — all in the same render. Previously every one called
 * `apiGet("/auth/context")` independently, and because that endpoint is
 * (correctly) `cache: "no-store"`, nothing deduped them: 2–3 real backend
 * round-trips to the same endpoint on every single navigation, which was the
 * dominant contributor to the "slow skeleton" feel across otherwise-unrelated
 * pages (#254).
 *
 * React's `cache()` collapses those into a single in-flight fetch per request.
 * It intentionally does NOT cache across requests — permissions must never be
 * served stale — so each fresh navigation still re-reads the user's live roles.
 *
 * RETRIED ONCE on a 5xx / unreachable API (#688). Every capability gate in the
 * app hangs off this one call, so a single cold-start blip here strips the nav
 * and the action buttons for the whole page — the exact symptom reported in the
 * 2026-08-18 incident. A 4xx is never retried: that is a real answer.
 */
export const getAuthContext = cache(
  (): Promise<UserContext> => apiGetWithRetry<UserContext>("/auth/context"),
);

/**
 * The outcome of reading `/auth/context`, with "we were told no" kept SEPARATE
 * from "we could not ask" (#688).
 *
 * `denied` and `unavailable` used to collapse into the same `catch { … = false }`
 * across the app, and that conflation is what made the 2026-08-18 outage read as
 * a UI bug: the API was erroring on every request, the layout caught it, and a
 * Super Admin was silently rendered as an account with no capabilities — no
 * Manage menu, no Engineer menu, no data. Nothing on screen said the backend was
 * down. Callers must now handle the two separately: degrade on `denied`, say so
 * on `unavailable`.
 */
export type AuthContextResult =
  | { status: "ok"; ctx: UserContext }
  /** 401/403 — the backend answered, and the answer is no. Degrade the UI. */
  | { status: "denied"; httpStatus: number }
  /**
   * Anything else — 5xx, timeout, unreachable. We do NOT know what this account
   * may do, so a reduced UI would be a guess presented as fact. Show an error.
   */
  | { status: "unavailable"; httpStatus: number | null };

/**
 * {@link getAuthContext} as a result rather than a throw, so a caller can tell
 * a permission answer from a fault. Deduped with `getAuthContext` for the
 * request (it goes through the same `cache()`d call), so mixing the two on one
 * page still costs a single round-trip.
 */
export async function readAuthContext(): Promise<AuthContextResult> {
  try {
    return { status: "ok", ctx: await getAuthContext() };
  } catch (e) {
    const httpStatus = e instanceof ApiError ? e.status : null;
    return isPermissionAnswer(httpStatus)
      ? { status: "denied", httpStatus: httpStatus as number }
      : { status: "unavailable", httpStatus };
  }
}
