/**
 * One place that turns a failed API read into the words a user sees (#688).
 *
 * THE DEFECT THIS EXISTS TO KILL: a caught error that leaves the data variable
 * `null` renders exactly like an endpoint that legitimately returned nothing.
 * During the 2026-08-18 prod incident every request was failing and the app
 * read as "there is no data" rather than "something is broken" — the reported
 * symptom was a UI bug, and it cost real time to diagnose as an auth/schema
 * failure. So every message below says, in plain words, that nothing was
 * loaded; none of them can be mistaken for an empty result set.
 *
 * WHY IT TAKES A BARE `status` AND NOT AN `ApiError`: `@/lib/api` imports
 * `next/headers`, which cannot be pulled into a client bundle. Keeping this
 * module free of that import lets client components describe a failure too, and
 * lets the suite next door run in vitest's node environment. Callers pass
 * `error.status`; a non-`ApiError` throw (a network fault, a thrown string)
 * carries no status, so it maps to `null` — see {@link describeLoadFailure}.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: repeat the backend's own error text. This
 * app holds alumni records; upstream messages can carry table names, row ids,
 * and internal URLs, and the pages here used to render `error.message` straight
 * into the page. The status code is kept as a support reference — a bare number
 * is not a disclosure, and it is what makes a triage call answerable.
 */

/** The failure classes worth telling apart on screen. */
export type LoadFailureKind =
  /** No response at all — the API is unreachable or the URL is unconfigured. */
  | "unreachable"
  /** The request was accepted but never came back in time. */
  | "timeout"
  /** The API answered with a 5xx — it is up, but it broke on this request. */
  | "server"
  /** 401 — signed out, expired, or superseded by a newer session (#147). */
  | "signed-out"
  /** 403 — authenticated, but this account is not allowed this data. */
  | "forbidden"
  /** 429 — throttled; the same request will work shortly. */
  | "rate-limited"
  /** Any other 4xx — the request itself was rejected. */
  | "rejected";

export interface LoadFailure {
  kind: LoadFailureKind;
  /** Heading. Short, and never phrased as an amount of data. */
  title: string;
  /** One line of explanation, safe to show to any signed-in user. */
  message: string;
  /** Would the identical request plausibly succeed on a second try? */
  retryable: boolean;
  /** HTTP status to print as a support reference; null when nothing answered. */
  reference: number | null;
}

/**
 * Describe a failed read of `noun` in words.
 *
 * `noun` is a lowercase noun phrase naming what failed to load, written to slot
 * into "Couldn't load ___" — e.g. `"links"`, `"the audit log"`, `"activity"`.
 *
 * `status` is `ApiError.status`: `0` for a transport-level failure (the class
 * uses 0 for "never reached the server"), or `null` when the throw was not an
 * `ApiError` at all and we genuinely do not know what happened.
 */
export function describeLoadFailure(
  status: number | null,
  noun: string,
): LoadFailure {
  // No status: either nothing answered (0) or the throw wasn't an ApiError.
  // Both mean the same thing to the reader — we never got a reply — and both
  // are worth retrying, since a cold start or a dropped connection is the
  // common cause.
  if (status === null || status === 0) {
    return {
      kind: "unreachable",
      title: "Couldn’t reach the service",
      message: `The app couldn’t connect to the service, so ${noun} could not be loaded. This is a connection fault, not an empty result — try again in a moment.`,
      retryable: true,
      reference: null,
    };
  }

  // 408/504 are the two ways "it took too long" comes back — one from the
  // service, one from a gateway in front of it. Same story for the reader.
  if (status === 408 || status === 504) {
    return {
      kind: "timeout",
      title: `Loading ${noun} timed out`,
      message: `The service didn’t answer in time, so nothing was loaded. Nothing is missing from the data — try again in a moment.`,
      retryable: true,
      reference: status,
    };
  }

  if (status === 401) {
    return {
      kind: "signed-out",
      title: "Please sign in again",
      message:
        "Your session has expired, or you signed in somewhere else. Sign in again to pick up where you left off.",
      retryable: false,
      reference: status,
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      title: "Your account isn’t provisioned for this",
      message: `You’re signed in, but this account isn’t allowed to see ${noun}. Ask a Super Admin to grant your account the access it needs.`,
      retryable: false,
      reference: status,
    };
  }

  if (status === 429) {
    return {
      kind: "rate-limited",
      title: "Too many requests",
      message: `The service is throttling requests, so ${noun} wasn’t loaded. Wait a few seconds and try again.`,
      retryable: true,
      reference: status,
    };
  }

  if (status >= 500) {
    return {
      kind: "server",
      title: `Couldn’t load ${noun}`,
      message: `The service returned an error, so nothing was loaded — this is a fault, not an empty result. Try again in a moment.`,
      retryable: true,
      reference: status,
    };
  }

  // Any other 4xx. A retry sends the identical rejected request, so it is not
  // offered; reloading the page after changing something is the way out.
  return {
    kind: "rejected",
    title: `Couldn’t load ${noun}`,
    message: `The request was rejected, so nothing was loaded — this is a fault, not an empty result. Reload the page, and let the Finance Department know if it keeps happening.`,
    retryable: false,
    reference: status,
  };
}

/**
 * Is this status the backend's answer about PERMISSIONS, rather than a fault?
 *
 * The distinction is the whole point of #688 on the capability path. A 401/403
 * from `/auth/context` is a real answer — this account may not do that — and
 * degrading the UI to match is correct. Anything else (a 5xx, a timeout, an
 * unreachable API) means we do not KNOW what they may do, and rendering a
 * reduced UI then misrepresents their account: that is precisely what made the
 * 2026-08-18 incident look like a missing-dropdown UI bug instead of an outage.
 */
export function isPermissionAnswer(status: number | null): boolean {
  return status === 401 || status === 403;
}
