"use client";

import { useEffect, useState } from "react";
import { clientGet } from "@/lib/api-client";

/** The editable controlled-vocabulary categories (mirrors the backend
 *  VocabularyCategory enum). Each feeds one or more dropdowns in the app. */
export type VocabCategory =
  | "industry"
  | "event_type"
  | "attendance_status"
  | "interaction_type";

/**
 * Active, admin-curated dropdown options for a vocabulary category, fetched live
 * from GET /vocabulary/{category} in the browser (the same source the server-
 * rendered dropdowns use). This is what makes an edit in Admin → Vocabulary show
 * up in a CLIENT-rendered dropdown (add/edit forms, profile dialogs, map filter)
 * instead of a stale hardcoded constant.
 *
 * `fallback` (the historical hardcoded list) is shown until the fetch resolves,
 * and is kept whenever the fetch fails or returns empty, so a dropdown never
 * renders blank. We do NOT cache across mounts on purpose — a vocab edit must be
 * reflected the next time a dropdown opens within the same session, not only
 * after a full reload.
 *
 * `enabled` lets a lazily-opened dialog defer the fetch until it is actually
 * shown (pass the dialog's `open` state).
 */
export function useVocabOptions(
  category: VocabCategory,
  fallback: readonly string[] = [],
  enabled = true,
): readonly string[] {
  const [options, setOptions] = useState<readonly string[]>(fallback);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    clientGet<{ category: string; values: string[] }>(`/vocabulary/${category}`)
      .then((res) => {
        // Only replace the fallback when we got a non-empty active list back.
        if (active && Array.isArray(res.values) && res.values.length > 0) {
          setOptions(res.values);
        }
      })
      .catch(() => {
        // Keep the fallback on any transient/network error — never blank out.
      });
    return () => {
      active = false;
    };
  }, [category, enabled]);

  return options;
}

/**
 * Ensure a stored value that is no longer in the active vocabulary (e.g. an
 * imported or since-hidden option) still appears as a selectable option — kept
 * first so editing an unrelated field doesn't silently overwrite it. Mirrors the
 * legacy-value handling the event-type and interaction-type forms already do.
 */
export function withValue(
  options: readonly string[],
  value: string | null | undefined,
): readonly string[] {
  const v = value?.trim();
  if (v && !options.includes(v)) return [v, ...options];
  return options;
}
