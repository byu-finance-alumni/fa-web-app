import { cache } from "react";
import { apiGet } from "@/lib/api";
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
 */
export const getAuthContext = cache(
  (): Promise<UserContext> => apiGet<UserContext>("/auth/context"),
);
