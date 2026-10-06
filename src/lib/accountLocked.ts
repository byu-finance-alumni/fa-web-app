/**
 * The hard account lock, client side.
 *
 * The backend answers EVERY authenticated route with 403 and
 * `error.code === "account_locked"` once an account is hard-locked (an
 * administrator's lock, or the failed-login lock fully engaged). That is a
 * different answer from an ordinary 403 ("this role can't do that"): the
 * session itself is dead, so the right response is to sign out and go to
 * /login — not to render a "you don't have access" state on every page.
 *
 * Pure so the decision is unit-testable without a browser; `SessionGuard` and
 * the login server action are the callers.
 */

/** Machine code the backend puts in `error.code` for a hard-locked account. */
export const ACCOUNT_LOCKED_CODE = "account_locked";

/** Read `error.code` off a backend error body, or null if there isn't one. */
export function errorCodeOf(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Is this response the hard-lock refusal? Only a 403 carrying the code. */
export function isAccountLocked(status: number, code: string | null | undefined): boolean {
  return status === 403 && code === ACCOUNT_LOCKED_CODE;
}
