"use client";

import { useEffect, useState } from "react";
import { clientGet } from "@/lib/api-client";
import { REGION_OPTIONS } from "@/constants/dropdowns";
import type { components } from "@/types/api.gen";

/** The backend's state -> region payload, straight off the OpenAPI contract. */
type StateRegionMap = components["schemas"]["StateRegionMap"];

/** The editable controlled-vocabulary categories (mirrors the backend
 *  VocabularyCategory enum). Each feeds one or more dropdowns in the app. */
export type VocabCategory =
  | "industry"
  | "event_type"
  | "attendance_status"
  | "interaction_type";

/**
 * Which slice of a category's terms to request (mirrors the backend `scope`
 * query param on GET /vocabulary/{category}).
 *
 * * `"all"` (default) — every active term.
 * * `"primary"` — for `industry` only, additionally hides the four industries
 *   that may only be used as a SECONDARY industry (#452). The hidden terms are
 *   still active vocabulary and are still accepted on write; they are only
 *   withheld from the primary dropdown. No effect on other categories.
 */
export type VocabScope = "all" | "primary";

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
 *
 * `scope` narrows the returned terms — pass `"primary"` for the PRIMARY
 * industry dropdown (#452). Narrow the `fallback` to match (see
 * `PRIMARY_INDUSTRY_OPTIONS`), or the dropdown briefly offers options the
 * resolved fetch is about to drop.
 */
export function useVocabOptions(
  category: VocabCategory,
  fallback: readonly string[] = [],
  enabled = true,
  scope: VocabScope = "all",
): readonly string[] {
  const [options, setOptions] = useState<readonly string[]>(fallback);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const query = scope === "all" ? "" : `?scope=${scope}`;
    clientGet<{ category: string; values: string[] }>(
      `/vocabulary/${category}${query}`,
    )
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
  }, [category, enabled, scope]);

  return options;
}

/** The server's state -> region crosswalk (GET /vocabulary/state-regions). */
export type StateRegions = {
  /** The valid regions, in display order — the Region dropdown's options. */
  regions: readonly string[];
  /**
   * Canonical FULL state name -> region, for all 50 states + DC. `null` until
   * the fetch resolves (and on error), which callers must treat as "don't
   * auto-fill" rather than "no region".
   */
  regionByState: Readonly<Record<string, string>> | null;
};

/**
 * The 50-states + DC -> region crosswalk, fetched from the backend (#451).
 *
 * The frontend deliberately keeps NO copy of this map. The server builds the
 * payload from the very module its write path uses to derive `contact.region`
 * from the employment state, so a form auto-filling from this endpoint agrees
 * with what actually gets persisted. A hand-copied TypeScript map would rot
 * silently and no test could catch the disagreement — that is the whole reason
 * the endpoint exists.
 *
 * `regions` falls back to the hardcoded {@link REGION_OPTIONS} until the fetch
 * resolves (and on error) so the Region dropdown is never blank;
 * `regionByState` has no fallback for the same reason — guessing a region is
 * worse than not filling one in.
 */
export function useStateRegions(enabled = true): StateRegions {
  const [regions, setRegions] = useState<readonly string[]>(REGION_OPTIONS);
  const [regionByState, setRegionByState] = useState<Readonly<
    Record<string, string>
  > | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    clientGet<StateRegionMap>("/vocabulary/state-regions")
      .then((res) => {
        if (!active) return;
        if (Array.isArray(res.regions) && res.regions.length > 0) {
          setRegions(res.regions);
        }
        if (res.region_by_state && typeof res.region_by_state === "object") {
          setRegionByState(res.region_by_state);
        }
      })
      .catch((err) => {
        // Keep the fallback regions and leave `regionByState` null — the form
        // stays fully usable, region just doesn't auto-fill.
        //
        // But SAY SO. Swallowing this silently cost real debugging time: the
        // Region dropdown still renders (REGION_OPTIONS covers it) and every
        // other vocab dropdown has a fallback constant too, so a dead crosswalk
        // is invisible everywhere EXCEPT auto-fill quietly never firing —
        // indistinguishable from a wiring bug. The degrade is deliberate; the
        // silence was not.
        console.error(
          "[useStateRegions] GET /vocabulary/state-regions failed — region " +
            "auto-fill is disabled for this session. Region options fall back " +
            "to REGION_OPTIONS.",
          err,
        );
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { regions, regionByState };
}

// The pure option-set helpers live in ./vocab-options (no React, no `@/`
// imports) so they can be unit-tested on their own. Re-exported here so every
// caller keeps importing them from this one module.
export { withValue } from "./vocab-options";
