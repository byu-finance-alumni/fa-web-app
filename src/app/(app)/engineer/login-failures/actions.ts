import { apiGet } from "@/lib/api";
import type { operations } from "@/types/api.gen";

/**
 * Response shape of GET /admin/login-failures, taken straight from the generated
 * OpenAPI operation (never hand-written) so it stays in lockstep with the
 * backend contract. Equals components["schemas"]["LoginFailurePage"].
 */
export type LoginFailurePage =
  operations["list_login_failures_admin_login_failures_get"]["responses"][200]["content"]["application/json"];

/** One recorded failed sign-in row (LoginFailureRow), pulled from the page type. */
export type LoginFailureRow = LoginFailurePage["items"][number];

/**
 * Fetch a page of failed-login attempts (newest first). Engineer-only — the
 * backend re-enforces RequireEngineer on GET /admin/login-failures. Mirrors the
 * typed `apiGet` fetch the Logins tab does inline; callers catch ApiError.
 */
export async function getLoginFailures(
  limit: number,
  offset: number,
): Promise<LoginFailurePage> {
  return apiGet<LoginFailurePage>(
    `/admin/login-failures?limit=${limit}&offset=${offset}`,
  );
}
