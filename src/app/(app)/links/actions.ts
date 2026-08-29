"use server";

/**
 * Server actions behind the Links tab (api #441).
 *
 * All of them mirror the shape used everywhere else in this app (see
 * `pay-it-forward/actions.ts`): they return a discriminated result rather than
 * throwing, so the client component can show WHY something failed instead of a
 * generic message. The backend re-checks the caller's permission on every one of
 * these; the UI gates exist only so we never offer a control that 403s on click.
 */

import { revalidatePath } from "next/cache";
import { apiGet, apiGetFile, apiPost, ApiError } from "@/lib/api";
import type { Schema } from "@/types/api";
import {
  bulkDeleteBlockedReason,
  linksDateRangeError,
  linksExportErrorMessage,
  linksExportFilename,
  parseLinksFilters,
  toBulkDeleteIds,
  toCreateBody,
  toLinksExportQuery,
  validateAddLink,
  type AddLinkFormValues,
  type OpportunityLink,
  type OpportunityLinkBulkDeleteRequest,
  type OpportunityLinkBulkDeleteResult,
} from "@/lib/opportunityLinks";

export type LinkActionResult = { ok: true } | { ok: false; error: string };

/** What the add form's alumnus picker renders for one candidate. */
export interface AlumnusOption {
  alumni_id: number;
  name: string;
  /** Grad year and current employer, for telling two same-named alumni apart. */
  detail: string;
}

/** Approve a pending link. Requires the surveys-management permission. */
export async function approveLink(
  opportunityLinkId: number,
): Promise<LinkActionResult> {
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

export type BulkDeleteLinksResult =
  | { ok: true; result: OpportunityLinkBulkDeleteResult }
  | { ok: false; error: string };

/**
 * Permanently delete the links a staff member multi-selected in the Links tab.
 *
 * Requires the `links.delete` capability — seeded to Super Admin and Engineer
 * only, and NOT held by Full Access, which keeps approve/reject. The backend is
 * the control; the Edit button is hidden from everyone else purely so nobody is
 * offered a destructive action that would 403 on click.
 *
 * BEST-EFFORT by design, so this returns the whole per-id result rather than a
 * boolean: ids that no longer exist come back in `missing_ids` and the caller
 * reports them. Collapsing that into `{ ok: true }` would mean telling someone
 * five links were deleted when four were.
 *
 * The id list is normalised and cap-checked here as well as in the UI, because a
 * server action is a real endpoint anything can call and a raw 422 is a poor
 * answer to a delete request.
 */
export async function bulkDeleteLinks(
  opportunityLinkIds: readonly number[],
): Promise<BulkDeleteLinksResult> {
  const ids = toBulkDeleteIds(opportunityLinkIds);
  const blocked = bulkDeleteBlockedReason(ids);
  if (blocked) return { ok: false, error: blocked };

  const body: OpportunityLinkBulkDeleteRequest = {
    opportunity_link_ids: ids,
  };

  try {
    const result = await apiPost<OpportunityLinkBulkDeleteResult>(
      "/opportunity-links/bulk-delete",
      body,
    );
    revalidatePath("/links");
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApiError
          ? e.message
          : "Couldn't delete the selected links.",
    };
  }
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
 */
export async function searchAlumniForLink(q: string): Promise<AlumnusOption[]> {
  const term = q.trim();
  if (term.length < 2) return [];

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

export type ExportLinksResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string };

/**
 * The dated report (#771): the CURRENT list, as a CSV file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS TAKES A QUERY STRING AND NOT A FILTER OBJECT
 * ─────────────────────────────────────────────────────────────────────────────
 * This app has a recurring class of bug where the export covers a different
 * population than the list it was launched from — see the alumni export, where
 * the fix was to DERIVE the export's params from the list's rather than to write
 * them out twice. The same trap is here, and closing it takes two things:
 *
 *  1. THE ARGUMENT IS THE LIST'S OWN URL. `qs` is exactly what `toLinksQs` put
 *     in the address bar — the same string the page parsed to decide which rows
 *     to render. It is re-parsed here with the same `parseLinksFilters` the page
 *     used, so the filter state this action exports from IS the filter state the
 *     list rendered from. Accepting a hand-built object instead would let the
 *     caller pass a selection that was never on screen, which is the bug.
 *  2. THE BACKEND QUERY IS THE LIST'S, MINUS PAGING. `toLinksExportQuery` and
 *     `toLinksApiQuery` are the same assembler; a filter cannot reach one and
 *     miss the other.
 *
 * Re-parsing is also the hardening. A server action is a real endpoint anything
 * can call, so a junk `status` or a `2026-02-30` becomes the default rather than
 * a 422 the user cannot see the cause of. AUTHORIZATION is unchanged and stays
 * the backend's: `pending`/`rejected` need `surveys.manage` there, exactly as
 * for the list, and a caller who asks anyway gets the 403 message below.
 *
 * The CSV comes back as text and the browser turns it into a Blob download — the
 * pattern the alumni export already uses — because the response has no JSON
 * schema and a server action cannot stream a file. The name comes from the
 * backend's `Content-Disposition` so every download of the same report is filed
 * under the same dated name.
 */
export async function exportLinks(qs: string): Promise<ExportLinksResult> {
  const filters = parseLinksFilters(
    Object.fromEntries(new URLSearchParams(qs)),
  );

  // Refuse the doomed request rather than translating its 422 afterwards: an
  // inverted range is a typo in a form, and the user should read that instead of
  // a failed download.
  const rangeError = linksDateRangeError(filters);
  if (rangeError) return { ok: false, error: rangeError };

  try {
    const file = await apiGetFile(
      `/opportunity-links/export?${toLinksExportQuery(filters)}`,
    );
    return {
      ok: true,
      csv: file.text,
      filename: file.filename ?? linksExportFilename(),
    };
  } catch (e) {
    return {
      ok: false,
      error: linksExportErrorMessage(e instanceof ApiError ? e.status : null),
    };
  }
}
