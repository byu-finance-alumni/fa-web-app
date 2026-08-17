"use server";

/**
 * Server actions behind the Links tab (api #441).
 *
 * All four mirror the shape used everywhere else in this app (see
 * `pay-it-forward/actions.ts`): they return a discriminated result rather than
 * throwing, so the client component can show WHY something failed instead of a
 * generic message. The backend re-checks the caller's permission on every one of
 * these; the UI gates exist only so we never offer a control that 403s on click.
 *
 * SAMPLE-MODE REFUSAL. Every write here begins by refusing outright when local
 * sample mode is on. That is not belt-and-braces politeness — it is load
 * bearing. In sample mode the table is showing fabricated rows whose ids exist
 * in no database, while `NEXT_PUBLIC_API_URL` may still point at a real
 * environment (in this repo the checked-in `.env` value points at PROD). Without
 * this guard, clicking Approve on a fabricated row would send
 * `POST /opportunity-links/900001/approve` at whatever API is configured. So the
 * rule is simple and absolute: while fake data is on screen, no request leaves
 * this process.
 */

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import type { Schema } from "@/types/api";
import {
  sampleLinksEnabled,
  toCreateBody,
  validateAddLink,
  type AddLinkFormValues,
  type OpportunityLink,
} from "@/lib/opportunityLinks";

export type LinkActionResult = { ok: true } | { ok: false; error: string };

/** What the add form's alumnus picker renders for one candidate. */
export interface AlumnusOption {
  alumni_id: number;
  name: string;
  /** Grad year and current employer, for telling two same-named alumni apart. */
  detail: string;
}

const SAMPLE_REFUSAL =
  "Sample data mode is on, so nothing was sent to the API. Restart with `npm run dev` to use real data.";

const inSampleMode = () => sampleLinksEnabled(process.env);

/** Approve a pending link. Requires the surveys-management permission. */
export async function approveLink(
  opportunityLinkId: number,
): Promise<LinkActionResult> {
  if (inSampleMode()) return { ok: false, error: SAMPLE_REFUSAL };
  try {
    await apiPost(`/opportunity-links/${opportunityLinkId}/approve`, {});
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't approve the link.",
    };
  }
  revalidatePath("/links");
  return { ok: true };
}

/** Reject a pending link. Requires the surveys-management permission. */
export async function rejectLink(
  opportunityLinkId: number,
): Promise<LinkActionResult> {
  if (inSampleMode()) return { ok: false, error: SAMPLE_REFUSAL };
  try {
    await apiPost(`/opportunity-links/${opportunityLinkId}/reject`, {});
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't reject the link.",
    };
  }
  revalidatePath("/links");
  return { ok: true };
}

export type CreateLinkResult =
  | { ok: true; opportunityLinkId: number }
  | { ok: false; error: string };

/**
 * Staff manual entry. The created link lands approved — a staff member typing it
 * in IS the review step, so it does not queue behind one.
 *
 * The form's own validation runs again here. Not because the client's answer is
 * distrusted as a security matter (the backend is the control), but because a
 * server action is a real HTTP endpoint that anything can call, and a 422 with a
 * backend field path reads worse than the message the form already knows.
 */
export async function createLink(
  values: AddLinkFormValues,
): Promise<CreateLinkResult> {
  if (inSampleMode()) return { ok: false, error: SAMPLE_REFUSAL };

  const errors = validateAddLink(values);
  const firstError = Object.values(errors)[0];
  if (firstError) return { ok: false, error: firstError };

  try {
    const created = await apiPost<OpportunityLink>(
      "/opportunity-links",
      toCreateBody(values),
    );
    revalidatePath("/links");
    return { ok: true, opportunityLinkId: created.opportunity_link_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't save the link.",
    };
  }
}

/**
 * Typeahead for the add form's "which alumnus is this from?" field.
 *
 * A server action rather than a browser fetch so the alumni search runs with the
 * same server-side token and error handling as every other read on this screen —
 * there is no client API helper for authenticated GETs that this would otherwise
 * have to grow.
 *
 * In sample mode this is a READ, so instead of refusing it serves the fabricated
 * roster: the point of sample mode is that the whole screen is demonstrable
 * without a backend, and a picker that returns nothing would make the form
 * untestable.
 */
export async function searchAlumniForLink(q: string): Promise<AlumnusOption[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  if (inSampleMode()) {
    const { SAMPLE_ALUMNI_OPTIONS } = await import("@/lib/opportunityLinks.sample");
    const needle = term.toLowerCase();
    return SAMPLE_ALUMNI_OPTIONS.filter((a) =>
      a.name.toLowerCase().includes(needle),
    );
  }

  try {
    const page = await apiGet<Schema<"AlumniPage">>(
      `/alumni?q=${encodeURIComponent(term)}&limit=10&offset=0`,
    );
    return page.items.map((a) => {
      const first = (a.preferred_first_name || a.first_name || "").trim();
      const last = (a.last_name || "").trim();
      const detail = [
        a.graduation_year ? String(a.graduation_year) : null,
        a.current_employer,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        alumni_id: a.alumni_id,
        name: [first, last].filter(Boolean).join(" ") || `Alumnus #${a.alumni_id}`,
        detail,
      };
    });
  } catch {
    // A failed lookup is an empty picker with the form's own "no matches" copy —
    // never a thrown action that blanks the page mid-typing.
    return [];
  }
}
