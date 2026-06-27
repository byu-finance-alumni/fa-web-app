import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { isEngineer } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";

/**
 * Engineer Console gate (#162). Every `/engineer/*` route is engineer-only, so
 * we resolve the signed-in user's roles once here and bounce non-engineers to
 * the dashboard rather than rendering any console tool. The backend re-enforces
 * the engineer capability on every underlying endpoint — this is UX only.
 *
 * Fail SAFE on a transient `/auth/context` failure: a network blip / API 5xx
 * must NOT be misread as "not an engineer" and bounce a real engineer. We only
 * redirect when the backend DEFINITIVELY says this user isn't an engineer (we
 * read their roles and they lack engineer, or it returned 401/403). On any
 * other error we render — the engineer-only endpoints still 403 a non-engineer,
 * so access can't leak. Mirrors the gate that used to live on each moved page.
 */
export default async function EngineerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let deniedByBackend = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    deniedByBackend = !isEngineer(ctx.roles);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      deniedByBackend = true;
    }
  }
  if (deniedByBackend) redirect("/dashboard");

  return <>{children}</>;
}
