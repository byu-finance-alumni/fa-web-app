"use client";

import { useCallback, useEffect, useState } from "react";

import { clientGet } from "@/lib/api-client";
import type { components } from "@/types/api.gen";

/** One alum's submitted "confirm your info" update, straight off the OpenAPI. */
export type SurveyResponseItem = components["schemas"]["SurveyResponseItem"];

/**
 * The review queue for one graduation year, owned in ONE place.
 *
 * `PendingSubmissions` used to fetch this itself, which was fine while the list
 * was the only thing that knew about it. The Submissions tab now carries a count
 * badge (Jake, 2026-08-07), and two independent fetches of the same endpoint is
 * exactly how a badge ends up saying "3" over a list of two — so the fetch moved
 * up to the console, which hands the SAME array to the badge and to the panel.
 * They are the one state; they cannot drift.
 *
 * That also means the queue is read when the year is selected rather than when
 * the tab is opened. It has to be: the badge's whole job is to be right about a
 * tab nobody has clicked.
 */
export type PendingSubmissionsQueue = {
  /**
   * The submissions awaiting review, or `null` while the fetch is in flight.
   * `null` is not "none" — the badge shows nothing at all until this resolves,
   * so it can never flash a number it has to take back.
   */
  items: SurveyResponseItem[] | null;
  /** Re-read the queue from the backend, keeping what's on screen meanwhile. */
  reload: () => void;
  /**
   * Drop one submission after it has been applied or rejected. The list row goes
   * and the badge follows in the same render — that is the point of sharing the
   * state rather than refetching in two places.
   */
  removeItem: (surveyResponseId: number) => void;
};

/**
 * Load (and keep) the pending submissions for a graduation year.
 *
 * `null` for the year means no year is selected yet — there is nothing to ask
 * for, so the queue stays unknown rather than resolving to empty.
 */
export function usePendingSubmissions(
  gradYear: number | null,
): PendingSubmissionsQueue {
  const [items, setItems] = useState<SurveyResponseItem[] | null>(null);
  // Bumped by `reload`. Kept separate from the year so a manual refresh can hold
  // the current rows on screen while a year change clears them.
  const [nonce, setNonce] = useState(0);

  // A different class's queue is a different queue: clear first, so the badge
  // and the list can never show the previous year's figure against this year's
  // heading. Deliberately NOT in the fetch effect below — that one also runs on
  // a plain reload, where blanking the screen would make the badge blink.
  useEffect(() => {
    setItems(null);
  }, [gradYear]);

  useEffect(() => {
    if (gradYear === null) {
      setItems(null);
      return;
    }
    let cancelled = false;
    clientGet<SurveyResponseItem[]>(`/survey/campaigns/${gradYear}/responses`)
      .then((data) => {
        if (!cancelled) setItems(data ?? []);
      })
      .catch(() => {
        // A failed read is reported as an empty queue, the same as it always
        // was: the panel says "no submissions waiting" and the badge stays
        // silent. Better to under-claim than to badge a number we don't have.
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gradYear, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const removeItem = useCallback((surveyResponseId: number) => {
    setItems((prev) =>
      prev
        ? prev.filter((r) => r.survey_response_id !== surveyResponseId)
        : prev,
    );
  }, []);

  return { items, reload, removeItem };
}
