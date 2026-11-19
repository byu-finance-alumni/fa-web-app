"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { clientGet } from "@/lib/api-client";
import type { components } from "@/types/api.gen";

/**
 * The "new people waiting for review" number on the top bar (fa-web-app #958).
 *
 * New-people survey submissions (fa-web-api #661) sit in a review queue on the
 * Needs Surveying page. Nothing told staff they were there, so the top bar now
 * shows a small count beside that entry while any are waiting, and nothing at
 * all when none are.
 *
 * The count comes from `GET /survey/new-people/submissions/count`, a bare number
 * gated on `surveys.manage` — the same capability that can approve or reject —
 * so only reviewers ever see it. It is re-read on every page change, when the
 * window regains focus, and whenever the review queue changes on screen (the
 * queue announces it with {@link notifyNewPeoplePendingChanged}).
 */

export type NewPeoplePendingCount =
  components["schemas"]["NewPeoplePendingCount"];

export const NEW_PEOPLE_PENDING_PATH = "/survey/new-people/submissions/count";

/** Fired on `window` after the new-people queue changes (approve, reject, reload). */
export const NEW_PEOPLE_PENDING_EVENT = "fa:new-people-pending-changed";

/** Tell every count on the page to re-read. Safe to call during SSR (no-op). */
export function notifyNewPeoplePendingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NEW_PEOPLE_PENDING_EVENT));
}

/** A usable count from the endpoint's body, or null for anything else. */
export function pendingFromBody(body: unknown): number | null {
  const n = (body as Partial<NewPeoplePendingCount> | null | undefined)?.pending;
  return typeof n === "number" && Number.isFinite(n) && n >= 0
    ? Math.floor(n)
    : null;
}

/** The accessible wording for the count, or "" when there is none to announce. */
export function newPeoplePendingLabel(count: number | null): string {
  if (count === null || count <= 0) return "";
  return `${count.toLocaleString()} new ${count === 1 ? "person" : "people"} waiting for review`;
}

/**
 * The live count, or null while unknown / when the viewer may not review (the
 * endpoint 403s) / when the read failed. `enabled` false never asks at all —
 * pass the viewer's `surveys.manage` capability.
 */
export function useNewPeoplePendingCount(enabled: boolean): number | null {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => setNonce((n) => n + 1);
    window.addEventListener(NEW_PEOPLE_PENDING_EVENT, bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(NEW_PEOPLE_PENDING_EVENT, bump);
      window.removeEventListener("focus", bump);
    };
  }, [enabled]);

  useEffect(() => {
    // Disabled: nothing is asked, and the return below hides any old value.
    if (!enabled) return;
    let cancelled = false;
    clientGet<NewPeoplePendingCount>(NEW_PEOPLE_PENDING_PATH)
      .then((body) => {
        if (!cancelled) setCount(pendingFromBody(body));
      })
      .catch(() => {
        // Under-claim rather than guess: no number on a failed read.
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname, nonce]);

  return enabled ? count : null;
}
