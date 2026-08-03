/**
 * Map the alumni list's client filter state to the backend export filter shape.
 *
 * This MUST mirror the URL→backend mapping the list page does (see
 * `app/(app)/alumni/page.tsx`) so an export covers exactly the population the
 * user is looking at. `sort` is intentionally omitted — it doesn't change which
 * alumni match, only their order, and the export has its own stable order.
 */
import type { AlumniFilterState } from "@/components/alumni/AlumniFilters";
import type { AlumniExportFilters } from "@/types/export";

export function toExportFilters(f: AlumniFilterState): AlumniExportFilters {
  const orNull = (xs: string[]): string[] | null => (xs.length ? xs : null);
  return {
    q: f.q.trim() || null,
    // Name/identifier facets exist on the backend export schema for parity with
    // GET /alumni, but the alumni-list UI only exposes the unified `q` search box,
    // so they stay null here (nothing to mirror). Wire them up if/when the list
    // gains dedicated name/net_id/email facets.
    net_id: null,
    first_name: null,
    last_name: null,
    preferred_name: null,
    email: null,
    graduation_year: null,
    grad_year_min: f.ymin.trim() ? Number(f.ymin) : null,
    grad_year_max: f.ymax.trim() ? Number(f.ymax) : null,
    deceased: f.deceased === "only" ? true : f.deceased === "exclude" ? false : null,
    // The alumni-filter UI has no friends/alumni toggle, so an export mirrors the
    // list's default scope (alumni only): null lets the backend builder apply its
    // is_alumni=true default. (#218)
    is_alumni: null,
    // The alumni page no longer exposes a current-employer facet (#153), so the
    // export — which mirrors the visible list — never filters by employer.
    employer: null,
    past_employer: orNull(f.pastEmployer),
    industry: orNull(f.industry),
    // Secondary industry / employment status (#584) exist on the export schema
    // for parity with GET /alumni, but they're dashboard-deep-link-only params
    // the list panel doesn't hold in state — so, like `employer` above, there's
    // nothing to mirror and they stay null.
    secondary_industry: null,
    employment_status: null,
    // Gender + industry-group facets mirror the list's URL params so an export
    // matches the filtered view (#360 / #351-#352).
    gender: f.gender || null,
    industry_group: f.industryGroup || null,
    title: orNull(f.title),
    seniority: orNull(f.seniority),
    city: orNull(f.city),
    state: orNull(f.state),
    tag: orNull(f.tag),
    status_label: orNull(f.statusLabel),
    leadership_role: orNull(f.leadership),
    survey_status: orNull(f.surveyStatus),
    contacted_after: f.contactedAfter || null,
    contacted_before: f.contactedBefore || null,
    never_contacted: f.neverContacted,
    attended_event: f.attended,
    donor: f.donor,
    mentor_willing: f.mentor,
    guest_speaker_willing: f.speaker,
    missing_email: f.missingEmail,
    missing_employer: f.missingEmployer,
    duplicate: f.duplicate,
    include_archived: f.archived,
    cfa: f.cfa,
    // Same as above: the list panel has CFA/CPA tickboxes but no CFP one, so an
    // export can't be narrowed by it (#584).
    cfp: false,
    cpa: f.cpa,
    // needs_survey is forced on by the /needs-surveying view so an export there
    // covers exactly the biennial-due set.
    needs_survey: f.needsSurvey,
    sort: "name",
  };
}
