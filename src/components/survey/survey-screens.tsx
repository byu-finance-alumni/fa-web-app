"use client";

/**
 * The survey's VIEW LAYER — every screen an alum sees, with no data fetching,
 * no submit, and no token in sight.
 *
 * Two callers render these, and that is the entire point of the file existing
 * (#574):
 *   * `app/survey/[token]/page.tsx` — the real thing. Owns the fetch, the
 *     staged-response POST, and the photo upload.
 *   * `components/needs-surveying/SurveyPreview.tsx` — the staff "Sample
 *     survey" preview, over `SAMPLE_ALUM` with submitting disabled.
 *
 * Before this split the preview was a separate, hand-maintained question list
 * that the live survey never read, so the two drifted: staff previewed a form
 * no alum was ever sent. Anything visual belongs HERE, so both stay identical
 * by construction rather than by remembering to edit two files.
 */

import { Fragment, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink, Heart } from "lucide-react";

import { HeadshotCropper } from "@/components/alumni/HeadshotCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAY_IT_FORWARD_URL } from "@/types/survey";
import { STATE_NAMES } from "@/lib/geo/state-field";
import { validateLinkedinUrl } from "@/lib/urlSafety";
import {
  joinOtherDesignationSlots,
  splitOtherDesignationSlots,
} from "@/lib/designations";
import {
  INDUSTRY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PRIMARY_INDUSTRY_OPTIONS,
  SURVEY_EMPLOYMENT_STATUS_OPTIONS,
  isEmploymentStatusPlaceholder,
} from "@/constants/dropdowns";

export type Fields = Record<string, string>;

// Country dropdown options (#525) — United States FIRST, then the rest
// alphabetically. Kept local to the public survey (its only consumer); the app
// otherwise stores country as free text, so a stored value outside this list is
// still preserved by the select (see `SelectControl`).
const COUNTRY_OPTIONS: readonly string[] = [
  "United States",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Cambodia", "Cameroon", "Canada", "Chile", "China",
  "Colombia", "Costa Rica", "Croatia", "Cyprus", "Czechia", "Denmark",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia",
  "Ethiopia", "Fiji", "Finland", "France", "Georgia", "Germany", "Ghana",
  "Greece", "Guatemala", "Honduras", "Hong Kong", "Hungary", "Iceland",
  "India", "Indonesia", "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Latvia", "Lebanon",
  "Lithuania", "Luxembourg", "Malaysia", "Maldives", "Malta", "Mexico",
  "Mongolia", "Montenegro", "Morocco", "Mozambique", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Nigeria", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Panama", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Rwanda", "Saudi Arabia", "Senegal",
  "Serbia", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Tanzania",
  "Thailand", "Trinidad and Tobago", "Tunisia", "Turkey", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "Uruguay", "Venezuela", "Vietnam",
  "Zambia", "Zimbabwe", "Other",
];

// Industry choices for the current-industry dropdown (#525). "Other" is broken
// out separately so selecting it reveals a free-text input.
const INDUSTRY_CHOICES: readonly string[] = PRIMARY_INDUSTRY_OPTIONS.filter(
  (o) => o !== "Other",
);

/**
 * Marital status choices (#647) — re-exported from the shared constants module
 * so the survey's existing importers keep working.
 *
 * The list itself lives in `constants/dropdowns.ts` alongside the employment
 * statuses, mirroring `MARITAL_STATUSES` in fa-web-api. It was briefly kept
 * local here while the server list did not exist; it does now, so there is one
 * copy per repo rather than three, and the backend enforces it on write.
 */
export { MARITAL_STATUS_OPTIONS };

// The three keys the marital-status ↔ spouse-name interaction spans. Named
// because they are referenced from three places (the section list, the change
// handler, and the review panel's spouse-name collapse) and a typo in any one of
// them fails silently.
export const MARITAL_STATUS_KEY = "profile.marital_status";
export const SPOUSE_FIRST_NAME_KEY = "profile.spouse_first_name";
export const SPOUSE_LAST_NAME_KEY = "profile.spouse_last_name";

/**
 * Statuses that ASSERT there is no current spouse — the only ones for which a
 * spouse name still sitting on the record is worth asking about (#647).
 *
 * A deliberate whitelist, not "everything except Married". Anything we don't
 * recognise (a legacy free-text value, a status added later) must fall through
 * to "don't ask", because a prompt about deleting someone's spouse is only
 * acceptable when we are sure the answer they just gave contradicts it.
 *
 * "Widowed" IS NOT ON THIS LIST, AND MUST NEVER BE. Many widows deliberately
 * keep their spouse on the record — it is often the reason the record is
 * accurate at all — and a form popping up to ask whether they'd like to delete
 * their late spouse's name is a genuinely awful thing to hand someone in the
 * middle of a two-minute admin task. Widowed leaves the spouse name completely
 * alone: no dialog, no clearing, no highlight. If a widow wants the name gone
 * they can clear the two fields themselves, which is one scroll away. This is
 * not an oversight and should not be "fixed" into consistency with Single and
 * Divorced.
 */
export const SPOUSE_CLEAR_PROMPT_STATUSES: readonly string[] = [
  "Single",
  "Divorced",
];

/**
 * Whether changing marital status to `nextStatus` should ASK about the spouse
 * name on file. Never clears anything itself — the caller prompts, and only a
 * human answer clears (#647).
 *
 * Auto-clearing on a dropdown change is a destructive inference: the alum said
 * something about themselves, not about the record, and "Divorced" plus a name
 * we still hold is a question, not a contradiction we get to resolve for them.
 *
 * Returns false when there is no spouse name to lose (nothing to ask about),
 * when the status is blank (clearing the dropdown asserts nothing), and for
 * every status outside `SPOUSE_CLEAR_PROMPT_STATUSES` — including Widowed, for
 * the reason documented on that constant.
 *
 * Compared case-insensitively and trimmed, because the column is free text
 * historically and production holds casing drift from the intake sheet.
 */
export function shouldPromptSpouseClear(
  nextStatus: string | null | undefined,
  spouseFirstName: string | null | undefined,
  spouseLastName: string | null | undefined,
): boolean {
  const hasSpouseOnFile = Boolean(
    (spouseFirstName ?? "").trim() || (spouseLastName ?? "").trim(),
  );
  if (!hasSpouseOnFile) return false;
  const next = (nextStatus ?? "").trim().toLowerCase();
  if (!next) return false;
  return SPOUSE_CLEAR_PROMPT_STATUSES.some((s) => s.toLowerCase() === next);
}

export type FieldKind =
  | "text"
  | "boolean"
  | "date"
  | "usState"
  | "country"
  | "industry"
  | "employmentStatus"
  // A URL the alum types that STAFF later click from a signed-in session (api
  // #418). Its own kind for the same reason `employmentStatus` is one: the kind
  // names what the answer means, and the control decides what rule applies —
  // here `validateLinkedinUrl`, the identical rule "Add alumni" and profile
  // Edit → Employment show. Until now this was a plain `text` field with no rule
  // at all, which is how arbitrary strings reached the `linkedin_url` column.
  //
  // Inline feedback only. The backend re-validates on write, and every staff
  // screen scheme-checks the stored value before rendering it as a link, so a
  // row that predates this (or that never came through this form) is still
  // handled — see `@/lib/urlSafety`.
  | "linkedin"
  // Marital status over a fixed four-option list (#647). Its own kind rather
  // than a generic "select with options on the field" because every other
  // dropdown here works the same way — the kind names the vocabulary, and the
  // control decides where that vocabulary comes from, which is what lets the
  // backend become the source for it later without touching a section list.
  | "maritalStatus"
  // A single tickbox for "do you hold this designation" (#529). Distinct from
  // `boolean`, whose Yes/No radios ask a question; a checklist of designations
  // reads as a checklist, and it's what Jake's mock draws.
  | "designation"
  // The three free-text "Other" blanks, which are ONE field: they merge into the
  // single `other_designations` column. See `OtherDesignationsControl`.
  | "otherDesignations";
export type EditField = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  donateUrl?: string;
  /** Helper/placeholder text for a free-text input (e.g. grad-program examples). */
  placeholder?: string;
  /** Guidance shown under the label — examples too long to sit in the label. */
  helpText?: string;
  /**
   * Starts a labelled GROUP of fields inside a section (#649). Set on the FIRST
   * field of the group; every field after it belongs to that group until the
   * next `groupLabel`.
   *
   * A flat marker rather than a nested `Section.groups[]` on purpose. Two
   * screens read this same list — the review panel and the edit form — plus a
   * handful of key-based special cases (the spouse-name collapse, the
   * marital-status prompt), and all of them iterate `section.fields` linearly.
   * Nesting would have rewritten every one of those loops to buy grouping for
   * exactly one section. If a second section ever needs real nesting, that is
   * the moment to reach for it; today this is one optional string and two
   * render branches.
   */
  groupLabel?: string;
};
export type Section = { id: string; title: string; blurb: string; fields: EditField[] };

/**
 * What the alum SEES for a stored value — a placeholder non-answer reads as
 * blank (#572).
 *
 * Only `edits` is POSTed on submit, so blanking the display never writes: an
 * untouched field is absent from the payload and the stored `Unknown` survives
 * untouched in the database. It disappears only when the alum actually picks a
 * real status. Used by BOTH the review panel and the edit control so the two
 * can't disagree — reading "Unknown" on review and then finding an empty
 * dropdown after clicking edit is exactly the confusion this avoids.
 */
export function displayValue(field: EditField, value: string): string {
  if (field.kind === "employmentStatus" && isEmploymentStatusPlaceholder(value)) {
    return "";
  }
  return value;
}

/* ------------------------------------------------- controlled vocabularies -- */

/**
 * The list the SERVER will accept for each controlled-vocabulary kind, and the
 * whole reason this table exists (api #426).
 *
 * The public survey used to take free text for these columns, so anyone holding
 * a survey link could mint a phantom industry that then showed up in the
 * dashboard breakdown and the filters as though it were one of ours. The backend
 * now matches each submitted value against a fixed list and IGNORES anything
 * off it — the submission still returns 200, and the column keeps whatever it
 * already held. Silently. That disposition is right for a public endpoint (an
 * odd-looking real answer is never rejected back at someone who can't be told
 * why) but it means the FORM has to be the thing that speaks up, or an alum
 * types "Underwater Basket Weaving", is thanked for it, and we throw it away.
 *
 * THIS IS NOT THE LIST THE CONTROL OFFERS, and the difference is load-bearing:
 *
 *   * industry — offers `INDUSTRY_CHOICES` (the primary list minus "Other"),
 *     but ACCEPTS all of `INDUSTRY_OPTIONS`. The four primary-excluded
 *     industries (Law, Corporate Banking, Sales and Trading, Credit Risk) and
 *     the literal "Other" are hidden from the dropdown yet are perfectly good
 *     stored values the server still writes. Validating against the narrower
 *     offered list would refuse an alum whose record says "Law" for handing us
 *     back the exact value we sent them, which is the opposite of the point.
 *   * employmentStatus / maritalStatus — the offered list and the accepted list
 *     coincide today; they are listed so a `SelectControl` that later gains an
 *     "Other" escape hatch inherits the rule instead of reopening this hole.
 *
 * Mirrors `_FIELDS`' `choice` entries in fa-web-api/app/services/survey_responses.py.
 */
export const SURVEY_CHOICE_OPTIONS: Partial<Record<FieldKind, readonly string[]>> = {
  industry: INDUSTRY_OPTIONS,
  employmentStatus: SURVEY_EMPLOYMENT_STATUS_OPTIONS,
  maritalStatus: MARITAL_STATUS_OPTIONS,
};

/**
 * What the alum reads when they've given an answer the server would drop.
 *
 * Every one of these names the way OUT, not just the problem — the alum can't
 * fix a rule, only pick a different answer, so a message that stops at "that
 * isn't valid" leaves them stuck in a form they can't submit. Plain English, no
 * jargon, no field names they never saw.
 */
const SURVEY_CHOICE_ERRORS: Partial<Record<FieldKind, string>> = {
  industry:
    "We can only save an industry from the list above. Pick the closest match, or clear this box to leave the industry on your record as it is.",
  employmentStatus:
    "We can only save a status from the list. Please pick one of the options above.",
  maritalStatus:
    "We can only save an option from the list. Please pick one of the options above.",
};

/**
 * Whether `value` matches one of `options` the way the SERVER matches it —
 * trimmed and case-insensitive.
 *
 * The server re-canonicalises rather than rejecting on case (`_choice` in
 * fa-web-api), so "investment banking" is written as "Investment Banking" and
 * must not be complained about here. A stricter client rule would refuse values
 * the server would happily have taken, which is its own kind of silent loss.
 */
export function isCanonicalChoice(
  options: readonly string[],
  value: string,
): boolean {
  const v = value.trim().toLowerCase();
  return v !== "" && options.some((o) => o.trim().toLowerCase() === v);
}

/**
 * Whether `value` is the value ALREADY ON FILE for this field — the single
 * distinction this whole feature turns on.
 *
 * An off-list value on someone's record is not a mistake they are making now: it
 * is a real answer, recorded before the list existed, that the survey shows back
 * to them verbatim so nothing is lost. Handing it back unchanged is a no-op
 * server-side (the value is ignored, the column keeps it), so it must never
 * raise an error — blocking a legitimate alum from submitting is a worse outcome
 * than the bug this validation exists to fix.
 *
 * Compared trimmed and case-insensitively for the same reason the server does:
 * an off-list value re-submitted unchanged carries whatever casing drift the
 * record already holds.
 */
export function isValueOnFile(
  value: string,
  onFile: string | null | undefined,
): boolean {
  const v = value.trim().toLowerCase();
  return v !== "" && v === (onFile ?? "").trim().toLowerCase();
}

/**
 * The inline rule for one field, or `null` when the value is acceptable (api
 * #418, #426).
 *
 * Kind-driven, so a rule is added by giving a field the kind that carries it
 * rather than by naming keys in a validator — the same way `displayValue`
 * above special-cases by kind. Two rules today: `linkedin`, and the controlled
 * vocabularies in `SURVEY_CHOICE_OPTIONS`.
 *
 * `onFile` is the value the record HELD when the survey was opened, and is what
 * separates "the odd industry already on your record" from "you just typed
 * something we can't save". Passing it is not optional in practice: omit it and
 * every legacy record is blocked from submitting.
 *
 * Callers validate the fields the alum actually EDITED, never everything on
 * screen: the form is pre-filled from the record, and a legacy stored value
 * (production holds bare `linkedin.com/in/…` strings) must not block someone
 * from submitting an unrelated change they came here to make.
 */
export function validateSurveyField(
  field: EditField,
  value: string,
  onFile?: string | null,
): string | null {
  if (field.kind === "linkedin") return validateLinkedinUrl(value);
  const options = SURVEY_CHOICE_OPTIONS[field.kind];
  if (!options) return null;
  // A blank is a skipped question, not a bad answer — the server treats it as
  // "leave what's on file alone" (`blankable=False`), so clearing the box is a
  // legitimate way out of this message rather than a second complaint.
  if (!value.trim()) return null;
  if (isCanonicalChoice(options, value)) return null;
  if (isValueOnFile(value, onFile)) return null;
  return SURVEY_CHOICE_ERRORS[field.kind] ?? null;
}

// The single source of truth for BOTH the review panel and the edit form —
// Employment status leads, then the rest of the Career Directors' list, grouped
// (order per Tanya, #568: status first, because the answer to it decides how
// much of the rest of the section even applies).
//
// Amy's meeting notes, 2026-08-06 (#649): "Residence" is no longer a section of
// its own and LinkedIn no longer sits under Personal. A three-field Residence
// section made the menu look like there was more to do than there was, and
// LinkedIn is how staff find someone's CURRENT JOB — it belongs next to the
// employer and title it corroborates, not next to their birthday.
export const INFO_SECTIONS: Section[] = [
  {
    id: "employment",
    title: "Employment",
    blurb: "Status, company, title, industry, work location, LinkedIn",
    fields: [
      { key: "profile.employment_status", label: "Employment Status", kind: "employmentStatus" },
      { key: "employment.current_employer", label: "Company", kind: "text" },
      { key: "employment.current_title", label: "Job Title", kind: "text" },
      { key: "employment.current_industry", label: "Industry", kind: "industry" },
      { key: "employment.current_industry_secondary", label: "Secondary Industry", kind: "text" },
      { key: "employment.current_city", label: "Employment city", kind: "text" },
      { key: "employment.current_state", label: "Employment state", kind: "usState" },
      { key: "employment.current_country", label: "Employment country", kind: "country" },
      { key: "employment.current_zip", label: "Company ZIP", kind: "text" },
      // Last, not next to Job Title: the four location fields above are one
      // block and splitting them to slot a URL in the middle reads worse than
      // ending on it. Moved here from Personal (#649).
      { key: "profile.linkedin_url", label: "LinkedIn", kind: "linkedin" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    // Seventeen fields — by far the longest section, and on a phone a flat
    // seventeen-input column is a wall nobody finishes. So it is ONE section
    // (one tap, one submit) with `groupLabel` subheadings inside it (#649):
    // the alum sees five short lists instead of one long one, and staff still
    // get a single "Personal" row in the menu.
    blurb: "Name, marriage, contact, residence, & personal details",
    fields: [
      { key: "profile.first_name", label: "First name", kind: "text", groupLabel: "Name" },
      // "Middle or Maiden name", verbatim and deliberately — staff have been
      // recording maiden names in `middle_name` for years, so the label has to
      // describe what the column actually holds or alumni will "correct" it by
      // wiping the maiden name we have. There IS an unused `birth_name` column
      // that would be the tidier home for it; surfacing it would split the same
      // fact across two columns and orphan everything already filed under
      // `middle_name`. Product call: do not surface `birth_name` here.
      { key: "profile.middle_name", label: "Middle or Maiden name", kind: "text" },
      { key: "profile.last_name", label: "Last name", kind: "text" },
      { key: "profile.preferred_first_name", label: "Preferred first name", kind: "text" },

      // Marital status LEADS this group so it sits directly beside the two
      // spouse names — that adjacency is the whole point of the regrouping. It
      // is also what makes the change-prompt legible: the name the question is
      // about is the next thing on screen (#647).
      { key: MARITAL_STATUS_KEY, label: "Marital status", kind: "maritalStatus", groupLabel: "Marriage" },
      { key: SPOUSE_FIRST_NAME_KEY, label: "Spouse first name", kind: "text" },
      { key: SPOUSE_LAST_NAME_KEY, label: "Spouse last name", kind: "text" },

      { key: "contact.personal_email", label: "Permanent email", kind: "text", required: true, groupLabel: "Contact" },
      { key: "contact.work_email", label: "Work email", kind: "text" },
      { key: "contact.phone", label: "Phone", kind: "text" },

      // Was its own section until #649. Same three columns, same order — only
      // the heading changed from a section title to a subheading.
      { key: "contact.city", label: "City", kind: "text", groupLabel: "Residence" },
      { key: "contact.state", label: "State", kind: "usState" },
      { key: "contact.country", label: "Country", kind: "country" },

      { key: "profile.gender", label: "Gender", kind: "text", groupLabel: "Personal details" },
      { key: "profile.birth_date", label: "Birthday", kind: "date" },
      { key: "profile.citizenship", label: "Citizenship", kind: "text" },
      { key: "profile.home_country", label: "Home country", kind: "country" },
    ],
  },
  {
    id: "grad",
    title: "Graduate school",
    blurb: "Program, school, graduation year",
    // Labels per Tanya (#569) — the examples cover the responses alumni actually
    // give, and sit in `helpText` rather than the label so the review panel's
    // two-column rows stay scannable.
    fields: [
      {
        key: "profile.graduate_degree",
        label: "Graduate Program",
        kind: "text",
        helpText: "ex: MBA, JD/LAW, Medical, Dental, PhD, MHA, MRED, etc.",
        placeholder: "e.g. MBA, JD/LAW, PhD…",
      },
      {
        key: "profile.graduate_school",
        label: "Graduate School",
        kind: "text",
        helpText: "ex: Duke, Harvard, Northwestern, BYU, etc.",
        placeholder: "e.g. Duke, Harvard, BYU…",
      },
      {
        key: "profile.graduate_graduation_year",
        label: "Projected or completed graduation year",
        kind: "text",
      },
    ],
  },
  {
    id: "designations",
    title: "Finance designations",
    blurb: "CFA, CFP, and anything else you hold",
    // Per Jake (#529): CFA and CFP are the only presets — every other answer the
    // survey has drawn so far (Series 7, Series 65 and the rest of the NASAA
    // series) goes in a free-text blank, and the preset list only grows once the
    // responses show what's actually common.
    //
    // CFA/CFP write DEDICATED columns (alumni_program_engagement), not the free
    // text: the designation filter and counts read those columns, so a ticked
    // CFA stored as free text would make that alum invisible to the CFA filter.
    fields: [
      { key: "program.cfa_designation", label: "CFA", kind: "designation" },
      { key: "program.cfp_designation", label: "CFP", kind: "designation" },
      // CPA joined the tickboxes on 2026-08-03. It had a column and a filter all
      // along but no way for an alum to populate it, so a CPA went into an
      // "Other" blank as free text and never showed up in the CPA filter.
      { key: "program.cpa_designation", label: "CPA", kind: "designation" },
      {
        key: "profile.other_designations",
        label: "Other designations",
        kind: "otherDesignations",
        helpText: "Anything else you hold — ex: Series 7, Series 65, FRM.",
      },
    ],
  },
];

export const ENGAGEMENT_SECTION: Section = {
  id: "engagement",
  title: "Ways to get involved",
  blurb: "Optional — mentoring, speaking, giving",
  fields: [
    { key: "program.mentor_willing", label: "Willing to mentor students?", kind: "boolean" },
    { key: "program.women_in_finance_mentor_willing", label: "Willing to mentor for Women in Finance?", kind: "boolean" },
    { key: "program.guest_speaker_willing", label: "Willing to be a guest speaker?", kind: "boolean" },
    { key: "program.help_at_event_willing", label: "Willing to help at an event?", kind: "boolean" },
    { key: "program.nettrek_host_willing", label: "Willing to host a NetTrek visit?", kind: "boolean" },
    { key: "program.finance_conference_willing", label: "Willing to take part in the finance conference?", kind: "boolean" },
    { key: "program.company_event_sponsor_willing", label: "Willing to sponsor a company event?", kind: "boolean" },
    { key: "program.case_competition_host_willing", label: "Willing to host a case competition?", kind: "boolean" },
    { key: "program.piff_donor", label: "Would you like to donate to the Pay It Forward fund?", kind: "boolean", donateUrl: PAY_IT_FORWARD_URL },
  ],
};

export const EDIT_SECTIONS: Section[] = [...INFO_SECTIONS, ENGAGEMENT_SECTION];

export function initialsOf(name: string): string {
  return (
    name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() ||
    "?"
  );
}

/* ------------------------------------------------------------ review group -- */

export function ReviewGroup({ section, fields }: { section: Section; fields: Fields }) {
  // Fields split into their `groupLabel` runs (#649). The read view has the same
  // problem the edit form does — seventeen rows under one "Personal" heading is
  // an unreadable slab — so the subheadings render here too, from the same
  // markers. One list, two screens: that is why the marker lives on the field
  // rather than in either renderer.
  //
  // Rows are still built one-per-field with the spouse collapse applied inside
  // the run, so first/last stay ONE "Spouse name" row and the run they belong to
  // is unaffected by the collapse.
  const groups: { label: string | null; rows: { label: string; value: string }[] }[] = [];
  for (const f of section.fields) {
    if (f.groupLabel || groups.length === 0) {
      groups.push({ label: f.groupLabel ?? null, rows: [] });
    }
    const rows = groups[groups.length - 1].rows;
    if (f.key === SPOUSE_LAST_NAME_KEY) continue;
    if (f.key === SPOUSE_FIRST_NAME_KEY) {
      const spouse = [fields[SPOUSE_FIRST_NAME_KEY], fields[SPOUSE_LAST_NAME_KEY]]
        .filter(Boolean)
        .join(" ");
      rows.push({ label: "Spouse name", value: spouse });
    } else {
      rows.push({ label: f.label, value: displayValue(f, fields[f.key] ?? "") });
    }
  }
  // A subheading with nothing under it is noise — only reachable if a group
  // consisted solely of the collapsed spouse-last-name field, but cheap to rule
  // out permanently.
  const shown = groups.filter((g) => g.rows.length > 0);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-800">
        {section.title}
      </h3>
      {shown.map((group, i) => (
        // Each run gets its own <dl> rather than headings inside one list: a
        // <dl> may only contain dt/dd (or divs wrapping them), so an <h4> in
        // there would be invalid markup that screen readers read unpredictably.
        <div key={group.label ?? `group-${i}`} className={i === 0 ? "" : "mt-3"}>
          {group.label ? (
            <h4 className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {group.label}
            </h4>
          ) : null}
          <dl className="mt-1.5 divide-y divide-gray-100">
            {group.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-6 py-1.5">
                <dt className="shrink-0 text-xs text-gray-500">{r.label}</dt>
                <dd className="min-w-0 break-words text-right text-sm font-medium text-gray-900">
                  {r.value ? r.value : <span className="font-normal text-gray-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- edit flow -- */

export function EditFlow({
  firstName,
  name,
  valueOf,
  onFileValueOf,
  setEdit,
  openSection,
  openSectionNav,
  closeSectionNav,
  photoPreview,
  setPhotoPreview,
  setPhotoFile,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: {
  firstName: string;
  name: string;
  valueOf: (key: string) => string;
  /**
   * The value the RECORD held when the survey was opened — never the alum's
   * in-progress edit (#426).
   *
   * `valueOf` can't answer this: it already folds `edits` over the record, so by
   * the time a controlled-vocabulary field is being checked it returns whatever
   * was just typed. The only question that matters for those fields is "is this
   * the odd value we sent them, or something new they've entered?", and that
   * needs the untouched original. See `isValueOnFile`.
   */
  onFileValueOf: (key: string) => string;
  setEdit: (key: string, value: string) => void;
  openSection: string | null;
  /** Open a section AND push a history entry so Back returns here (#526). */
  openSectionNav: (id: string) => void;
  /** Close the open section by popping that history entry (#526). */
  closeSectionNav: () => void;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  setPhotoFile: (v: File | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const section =
    openSection === "photo"
      ? null
      : EDIT_SECTIONS.find((s) => s.id === openSection);

  // The status the alum just picked that we're ASKING about their spouse name
  // for, or null when there's nothing to ask (#647). Never used to decide what
  // to save — only whether the question is on screen.
  const [spousePrompt, setSpousePrompt] = useState<string | null>(null);

  // Inline field errors, keyed by field key (api #418), plus the set of fields
  // the alum has actually EDITED. Only edited fields are checked on submit: the
  // form is pre-filled from the record, and production holds legacy values
  // (bare `linkedin.com/in/…`) that must not stand between someone and the
  // unrelated change they came here to make.
  //
  // `touched` is a plain Set in state rather than a ref because nothing renders
  // from it — it is only read inside the submit handler — but it must survive
  // the re-renders that opening and closing sections cause.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  // Every field writes through here so the marital-status ↔ spouse-name
  // question has somewhere to live. The status change itself is ALWAYS applied
  // immediately — the alum answered that question and we take the answer; the
  // only thing in doubt is the spouse name, which nothing but a human answer
  // will touch.
  const onFieldChange = (field: EditField, next: string) => {
    setEdit(field.key, next);
    setTouched((prev) => {
      if (prev.has(field.key)) return prev;
      const updated = new Set(prev);
      updated.add(field.key);
      return updated;
    });
    // Typing is the alum answering the complaint — drop it and re-check on blur
    // rather than re-running the rule against a half-typed URL.
    setFieldErrors((prev) => {
      if (!prev[field.key]) return prev;
      const updated = { ...prev };
      delete updated[field.key];
      return updated;
    });
    if (field.key !== MARITAL_STATUS_KEY) return;
    // Recomputed on EVERY status change, so picking "Divorced" and then
    // correcting it to "Married" takes the question back down rather than
    // leaving a stale prompt about a status they no longer claim.
    setSpousePrompt(
      shouldPromptSpouseClear(
        next,
        valueOf(SPOUSE_FIRST_NAME_KEY),
        valueOf(SPOUSE_LAST_NAME_KEY),
      )
        ? next
        : null,
    );
  };

  const onFieldBlur = (field: EditField) => {
    const msg = validateSurveyField(
      field,
      valueOf(field.key),
      onFileValueOf(field.key),
    );
    setFieldErrors((prev) => {
      if ((prev[field.key] ?? null) === msg) return prev;
      const updated = { ...prev };
      if (msg) updated[field.key] = msg;
      else delete updated[field.key];
      return updated;
    });
  };

  // Submit gate (api #418). Re-checks every EDITED field, then opens the
  // section holding the first complaint so the alum lands on the input with the
  // message under it — an error banner on the menu screen would name a field
  // they'd then have to go hunting for.
  //
  // Client-side only, and deliberately not the last word: the backend validates
  // the same value on write, and the staff screens that render it guard
  // themselves. This exists so an alum learns about a typo here rather than
  // never learning about it at all — and, for the controlled vocabularies, so
  // they learn about it AT ALL: the server's disposition for an off-list answer
  // is to ignore it and return success (#426).
  //
  // Still gated on `touched`, and doubly so for the vocabularies, which also
  // compare against the on-file value. Either guard alone would let a legacy
  // record through; together they also cover the alum who fiddles with the
  // industry dropdown and puts their own odd value back exactly as it was.
  const handleSubmit = () => {
    const found: Record<string, string> = {};
    for (const s of EDIT_SECTIONS) {
      for (const f of s.fields) {
        if (!touched.has(f.key)) continue;
        const msg = validateSurveyField(f, valueOf(f.key), onFileValueOf(f.key));
        if (msg) found[f.key] = msg;
      }
    }
    setFieldErrors(found);
    const firstBad = Object.keys(found)[0];
    if (!firstBad) {
      onSubmit();
      return;
    }
    const owning = EDIT_SECTIONS.find((s) =>
      s.fields.some((f) => f.key === firstBad),
    );
    if (owning) openSectionNav(owning.id);
  };

  // A specific section (or the photo screen) is open.
  if (openSection) {
    return (
      <>
        <button
          type="button"
          onClick={closeSectionNav}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue-600 hover:text-brand-blue-500"
        >
          ← All sections
        </button>
        {openSection === "photo" ? (
          <PhotoSection
            name={name}
            photoPreview={photoPreview}
            setPhotoPreview={setPhotoPreview}
            setPhotoFile={setPhotoFile}
          />
        ) : section ? (
          <>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
              {section.title}
            </h1>
            <div className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
              {section.fields.map((f) => (
                <Fragment key={f.key}>
                  {f.groupLabel ? (
                    // A rule + label, not just bold text: the groups are the
                    // only thing making a 17-field section scannable, so they
                    // have to survive a glance. `first:` strips the rule off the
                    // opening group, which would otherwise draw a line straight
                    // under the section heading.
                    <h2 className="border-t border-gray-200 pt-5 text-xs font-semibold uppercase tracking-wide text-navy-800 first:border-t-0 first:pt-0">
                      {f.groupLabel}
                    </h2>
                  ) : null}
                  <FieldControl
                    field={f}
                    value={valueOf(f.key)}
                    onFileValue={onFileValueOf(f.key)}
                    onChange={(v) => onFieldChange(f, v)}
                    onBlur={() => onFieldBlur(f)}
                    error={fieldErrors[f.key]}
                  />
                  {f.key === MARITAL_STATUS_KEY && spousePrompt ? (
                    <SpouseNamePrompt
                      status={spousePrompt}
                      spouseName={[
                        valueOf(SPOUSE_FIRST_NAME_KEY),
                        valueOf(SPOUSE_LAST_NAME_KEY),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onKeep={() => setSpousePrompt(null)}
                      onClear={() => {
                        setEdit(SPOUSE_FIRST_NAME_KEY, "");
                        setEdit(SPOUSE_LAST_NAME_KEY, "");
                        setSpousePrompt(null);
                      }}
                    />
                  ) : null}
                </Fragment>
              ))}
            </div>
          </>
        ) : null}
        <div className="mt-6">
          <Button type="button" variant="navy" size="lg" onClick={closeSectionNav}>
            Done
          </Button>
        </div>
      </>
    );
  }

  // Section menu.
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
          What would you like to update, {firstName}?
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
          Pick a section to edit. Change anything that&apos;s out of date, then
          submit — our team reviews updates before they&apos;re applied.
        </p>
      </div>

      <ul className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
        <SectionRow
          title="Profile photo"
          blurb="Upload a new headshot"
          onClick={() => openSectionNav("photo")}
        />
        {EDIT_SECTIONS.map((s) => (
          <SectionRow
            key={s.id}
            title={s.title}
            blurb={s.blurb}
            onClick={() => openSectionNav(s.id)}
          />
        ))}
      </ul>

      <a
        href={PAY_IT_FORWARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
        Donate to Pay It Forward
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>

      {/*
        The submit block (#648). This is a COMPLETION-RATE problem, not a colour
        preference: an alum who fills the whole form and never finds this button
        has done all the work and sent us nothing, and we can't tell that apart
        from someone who never opened the link.

        Four levers, applied together, roughly in order of how hard they pull:
          1. POSITION + ISOLATION — its own block behind a rule, with nothing
             beside it. "Back" used to sit on the same row, which on desktop put
             a competing control in the same glance; it now lives above, at the
             lowest emphasis the design system has.
          2. SIZE — full width at every breakpoint (it was `sm:w-auto`, i.e. it
             shrank to fit its label exactly where the screen had room to spare)
             and taller than the standard control height.
          3. COLOUR — green. An approved, documented exception to the palette;
             see the token comment below and UX-UI.md.
          4. WORDING — unchanged for now, per the ask.

        Colour is deliberately last. It is the weakest of the four on its own,
        and the reason the old navy button "blended in" was never really its hue
        — it was a same-size button in a row of buttons.
      */}
      <div className="mt-10 border-t border-gray-200 pt-8">
        <div className="flex">
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            Back
          </Button>
        </div>

        {submitError ? (
          <p className="mt-4 text-sm text-danger-600">{submitError}</p>
        ) : null}

        {/*
          `submit-green-600` / `-700` are real Tailwind tokens (tailwind.config.ts)
          — no hex in JSX, per UX-UI.md. Overridden on the shared Button via
          className rather than added as a Button variant on purpose: the
          exception is scoped to THIS button, and a `green` variant in the design
          system is an invitation to use green elsewhere, which is exactly what
          the palette rule exists to prevent.

          Hover goes DARKER (700), not lighter the way `brand-blue` does: a
          lighter green fails the 4.5:1 bar for white text, and a hover state
          that drops below AA is still a contrast failure.

          `md:h-12` as well as `h-12`: `size="lg"` sets `h-11 md:h-10`, and
          tailwind-merge only drops the conflicting *unprefixed* height, so
          without it the button would quietly shrink back to 40px on desktop.
        */}
        <Button
          type="button"
          size="lg"
          className="mt-4 h-12 w-full bg-submit-green-600 text-base text-white hover:bg-submit-green-700 active:bg-submit-green-700 md:h-12"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Submit my updates"}
        </Button>
      </div>

      <TrustNote />
    </>
  );
}

function SectionRow({
  title,
  blurb,
  onClick,
}: {
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-inset"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          <span className="text-xs text-gray-500">{blurb}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * The spouse-name question raised by a marital-status change (#647).
 *
 * Rendered INLINE, directly under the dropdown that raised it, rather than as a
 * modal dialog. Three reasons: it appears immediately above the two fields it is
 * about, so the alum can see the name in question; it doesn't seize focus in the
 * middle of typing; and on a phone a centred dialog over a form is the pattern
 * UX-UI.md explicitly steers away from.
 *
 * "Keep it" is listed first and is the visually heavier of the two. Doing
 * nothing at all — ignoring this entirely and scrolling on — also keeps the
 * name. Every path except one explicit click preserves the data.
 */
function SpouseNamePrompt({
  status,
  spouseName,
  onKeep,
  onClear,
}: {
  status: string;
  spouseName: string;
  onKeep: () => void;
  onClear: () => void;
}) {
  return (
    <div
      // `polite`, not `assertive`: it is a question about something already on
      // file, not an error, and nothing is lost by hearing it a beat late.
      aria-live="polite"
      className="rounded-md border border-warning-600/30 bg-warning-50 p-4"
    >
      <p className="text-sm leading-relaxed text-gray-900">
        You changed your marital status to <strong>{status}</strong>, and we
        still have{" "}
        {spouseName ? (
          <strong>{spouseName}</strong>
        ) : (
          "a spouse name"
        )}{" "}
        on file. Would you like to keep it?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onKeep}>
          Keep it
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
          onClick={onClear}
        >
          Remove it
        </Button>
      </div>
    </div>
  );
}

// Image types the canvas cropper can safely decode + export.
const PHOTO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Ceiling on the ORIGINAL picked file. The cropper always exports a small
// (≤1024px) JPEG, so the actual upload is tiny regardless — this only guards
// against decoding an absurdly large source. Generous so modern phone photos
// (often 20-40 MB) get through instead of being rejected before cropping.
const PHOTO_MAX_BYTES = 50 * 1024 * 1024;

function PhotoSection({
  name,
  photoPreview,
  setPhotoPreview,
  setPhotoFile,
}: {
  name: string;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  setPhotoFile: (v: File | null) => void;
}) {
  // Object URL open in the crop modal (null = closed). We keep the ORIGINAL
  // picked image's URL in a ref so "Adjust" can reopen the cropper on the full
  // photo (not the already-cropped result).
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origSrc = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setOrig = (url: string | null) => {
    if (origSrc.current) URL.revokeObjectURL(origSrc.current);
    origSrc.current = url;
  };

  // Validate, then open the cropper so the alum positions the photo in the
  // circle — same "adjust the frame" step the staff profile uses.
  const onPick = (file: File | null) => {
    if (!file) return;
    if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
      setError("That image type isn't supported. Use a JPG, PNG, or WebP.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("That image is too large. Please use one under 50 MB.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setOrig(url);
    setCropSrc(url);
  };

  // Cropper saved: the cropped square becomes the photo to upload + the preview.
  const onCropSave = (blob: Blob) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(new File([blob], "headshot.jpg", { type: "image/jpeg" }));
    setPhotoPreview(URL.createObjectURL(blob));
    setCropSrc(null);
  };

  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
        Profile photo
      </h1>
      <div className="mt-6 flex flex-col items-center gap-5 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="New profile photo preview"
            className="h-48 w-48 shrink-0 rounded-full object-cover shadow-sm"
          />
        ) : (
          <span className="flex h-48 w-48 shrink-0 items-center justify-center rounded-full bg-navy-800 text-5xl font-semibold text-white">
            {initialsOf(name)}
          </span>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-blue-500 focus-within:ring-offset-1">
              <input
                ref={inputRef}
                type="file"
                accept={PHOTO_ACCEPTED_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  onPick(e.target.files?.[0] ?? null);
                  // Reset so re-picking the SAME file still fires onChange.
                  e.target.value = "";
                }}
              />
              {photoPreview ? "Choose a different photo" : "Upload a photo"}
            </label>
            {photoPreview && origSrc.current ? (
              <button
                type="button"
                onClick={() => setCropSrc(origSrc.current)}
                className="font-medium text-brand-blue-600 hover:text-brand-blue-500"
              >
                Adjust
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="text-xs text-danger-600">{error}</p>
          ) : (
            <p className="text-xs text-gray-500">
              JPG, PNG, or WebP — you&apos;ll position it in the circle. Replaces
              the photo we have on file.
            </p>
          )}
        </div>
      </div>

      {cropSrc ? (
        <HeadshotCropper
          src={cropSrc}
          busy={false}
          onCancel={() => setCropSrc(null)}
          onSave={onCropSave}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- info panels - */

export function TrustNote() {
  return (
    <p className="mt-8 border-t border-gray-200 pt-6 text-sm leading-relaxed text-gray-500">
      This secure form was sent by the BYU Finance Department. Your response will
      be reviewed before any changes are applied.
    </p>
  );
}

export function InvalidPanel() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-navy-800">
        This link isn&apos;t valid
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">
        This survey link may have expired or been mistyped. If you received it in
        an email, try opening it again from the original message, or reach out to
        the BYU Finance team.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- field control -- */

// Shared native <select> styling — matches the Input's border/height/focus so
// dropdowns and text inputs line up in the edit form.
const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm " +
  "text-gray-900 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * `options`, with a stored value that isn't already on the list prepended to it.
 *
 * This is the single rule that keeps a controlled dropdown from destroying data
 * it doesn't recognise: an alum opening the survey to fix their phone number
 * must not have their unusual country, state, employment status or marital
 * status silently rewritten to blank because a list narrowed since it was
 * recorded. Extracted from `SelectControl` so it can be tested directly — the
 * suites run in Node with no DOM, so a mounted <select> can't be asserted on.
 */
export function withStoredValue(
  options: readonly string[],
  value: string,
): readonly string[] {
  return value && !options.includes(value) ? [value, ...options] : options;
}

/**
 * A native dropdown over a fixed option list (US states, countries). A stored
 * value that isn't in the list (e.g. an international province, or a country
 * spelled differently) is preserved by prepending it as a selectable option, so
 * opening the survey never silently blanks or rewrites what's on file.
 */
function SelectControl({
  id,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const opts = withStoredValue(options, value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * Current industry (#525): the controlled industry list with an "Other" option
 * that reveals a free-text input. A stored value outside the list is treated as
 * "Other" and shown in the text box, so nothing on file is lost.
 *
 * THAT PRESERVATION IS THE POINT OF THE TEXT BOX and must survive any change
 * here — an alum whose record says "Underwater Basket Weaving" opens the survey,
 * sees their own answer, and can submit an unrelated correction without it being
 * blanked or rewritten into something more generic.
 *
 * What CHANGED in #426: the box no longer accepts arbitrary new text in silence.
 * The server now writes only values on `INDUSTRY_OPTIONS` and ignores everything
 * else — returning success either way — so typing a brand-new off-list industry
 * used to end with the alum being thanked for an answer we discarded. The rule
 * is now enforced here, where it can actually be explained, with the on-file
 * value exempted so the legacy case above is untouched. See
 * `validateSurveyField` / `isValueOnFile`.
 *
 * `onFileValue` is the record's value, not the working one, which is what lets
 * the hint under the box tell those two situations apart.
 */
function IndustryControl({
  id,
  value,
  onFileValue,
  onChange,
  onBlur,
  error,
  errorId,
}: {
  id: string;
  value: string;
  onFileValue?: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  errorId?: string;
}) {
  const inList = INDUSTRY_CHOICES.includes(value);
  const [other, setOther] = useState(value !== "" && !inList);
  const selectValue = other ? "__other__" : inList ? value : "";
  const hintId = `${id}-industry-hint`;
  // The box currently holds the off-list value the record already had — the one
  // case that is NOT a mistake. Checked against the accepted list, not the
  // offered one, so a stored "Law" (hidden from the dropdown, but a perfectly
  // good stored value) reads as an ordinary industry rather than as a legacy
  // oddity we're apologising for.
  const showsValueOnFile =
    !isCanonicalChoice(INDUSTRY_OPTIONS, value) &&
    isValueOnFile(value, onFileValue);
  return (
    <>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other__") {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        className={SELECT_CLASS}
      >
        <option value="">Select an industry</option>
        {INDUSTRY_CHOICES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {other ? (
        <>
          {/*
            Validated on BLUR, like the LinkedIn field and for the same reason:
            a complaint that appears on the "U" of "Underwater" reads as the form
            arguing with someone who is typing fine.
          */}
          <Input
            className={
              error
                ? "mt-2 border-danger-600 focus-visible:ring-danger-600"
                : "mt-2"
            }
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId ?? hintId}
            placeholder="Type your industry"
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
          {/*
            The hint is suppressed while the error is up — `FieldControl` renders
            that message directly below this, and two lines of guidance stacked
            on one input is noise at the moment the alum is least able to read it.
          */}
          {error ? null : (
            <p id={hintId} className="mt-1 text-xs leading-relaxed text-gray-500">
              {showsValueOnFile
                ? "This is the industry we have on file, and we'll keep it as it is. To change it, pick one from the list above."
                : "We can only save industries from the list above — if yours isn't there, pick the closest match."}
            </p>
          )}
        </>
      ) : null}
    </>
  );
}

/**
 * The three free-text "Other" blanks (#529), which are ONE field: they merge
 * into the single `other_designations` column, joined with ", ".
 *
 * The blanks are LOCAL state seeded once from the stored string, because the
 * parent only ever sees the joined result. Re-splitting that on every render
 * would shuffle text between boxes mid-edit — clearing blank 1 would yank blank
 * 2's text up into it under the alum's cursor. How they arrange their answers is
 * theirs; the join is only how we store it.
 */
function OtherDesignationsControl({
  id,
  labelId,
  helpId,
  value,
  onChange,
}: {
  id: string;
  labelId: string;
  helpId?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [slots, setSlots] = useState(() => splitOtherDesignationSlots(value));

  const setSlot = (index: number, next: string) => {
    const updated = slots.map((s, i) => (i === index ? next : s));
    setSlots(updated);
    // Emit the WHOLE column value, never just the edited blank: one column backs
    // all three, so touching blank 1 has to carry blanks 2 and 3 along or
    // submitting would blank them out.
    onChange(joinOtherDesignationSlots(updated));
  };

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={helpId} className="space-y-2">
      {slots.map((slot, i) => (
        <Input
          key={i}
          // Only the first blank claims the visible label's `htmlFor`, so
          // clicking "Other designations" focuses where you'd start typing.
          id={i === 0 ? id : undefined}
          value={slot}
          aria-label={`Other designation ${i + 1}`}
          placeholder="Other"
          onChange={(e) => setSlot(i, e.target.value)}
        />
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value: storedValue,
  onFileValue,
  onChange,
  onBlur,
  error,
}: {
  field: EditField;
  value: string;
  /**
   * The value the RECORD holds, before any edit in this session. Only the
   * controlled-vocabulary controls read it, to tell an off-list value that was
   * already on file apart from one the alum has just typed (#426).
   */
  onFileValue?: string;
  onChange: (v: string) => void;
  /** Fires when a validated control loses focus — see `validateSurveyField`. */
  onBlur?: () => void;
  /** Inline message from `validateSurveyField`, owned by `EditFlow`. */
  error?: string;
}) {
  // A placeholder non-answer ("Unknown") renders as an untouched, empty control
  // — so it is never offered back as a choice — while staying in the DB (#572).
  const value = displayValue(field, storedValue);
  const controlId = `survey-${field.key}`;
  const labelId = `${controlId}-label`;
  const helpId = field.helpText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  // A designation is one tick, so its label belongs ON the box rather than as a
  // heading above it — "CFA" over an unlabelled checkbox reads as a question
  // with the answer missing. Yes/No radios (the `boolean` kind) would work too,
  // but four controls for a two-item checklist is heavier than what's being
  // asked, and Jake's mock draws it as a checklist. Values stay the "Yes"/"No"
  // the backend already parses, so nothing new has to learn a third vocabulary.
  //
  // `flex w-fit` rather than `inline-flex`: the section stacks its fields with
  // `space-y`, so two inline boxes would land side by side on one line with a
  // stray vertical offset between them.
  if (field.kind === "designation") {
    return (
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800">
        <input
          id={controlId}
          type="checkbox"
          checked={value === "Yes"}
          onChange={(e) => onChange(e.target.checked ? "Yes" : "No")}
          className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
        />
        {field.label}
      </label>
    );
  }

  return (
    <div>
      <Label id={labelId} htmlFor={controlId} className="text-sm font-medium text-gray-900">
        {field.label}
        {field.required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {field.helpText ? (
        <p id={helpId} className="mt-0.5 text-xs leading-relaxed text-gray-500">
          {field.helpText}
        </p>
      ) : null}
      <div className="mt-1.5">
        {field.kind === "text" ? (
          <Input
            id={controlId}
            value={value}
            required={field.required}
            aria-describedby={helpId}
            placeholder={field.placeholder ?? "Add a value"}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : field.kind === "linkedin" ? (
          // The same text box, plus the rule. `type="url"` (not `text`) gets
          // phones a keyboard with "/" and ".com" on it, which is most of why a
          // typed URL comes out malformed in the first place. Validated on BLUR
          // rather than per keystroke — an error appearing on the "h" of
          // "https" reads as the form arguing with someone who is typing fine.
          <Input
            id={controlId}
            type="url"
            inputMode="url"
            value={value}
            required={field.required}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId ?? helpId}
            placeholder="https://www.linkedin.com/in/you"
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className={
              error ? "border-danger-600 focus-visible:ring-danger-600" : undefined
            }
          />
        ) : field.kind === "date" ? (
          <Input
            id={controlId}
            type="date"
            value={value}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : field.kind === "usState" ? (
          <SelectControl
            id={controlId}
            value={value}
            options={STATE_NAMES}
            placeholder="Select a state"
            onChange={onChange}
          />
        ) : field.kind === "country" ? (
          <SelectControl
            id={controlId}
            value={value}
            options={COUNTRY_OPTIONS}
            placeholder="Select a country"
            onChange={onChange}
          />
        ) : field.kind === "employmentStatus" ? (
          // SURVEY_ not EMPLOYMENT_STATUS_OPTIONS: "Unknown" is a real option
          // everywhere staff work, but meaningless as a SELF-description — the
          // alum is being asked what they actually do (#377).
          <SelectControl
            id={controlId}
            value={value}
            options={SURVEY_EMPLOYMENT_STATUS_OPTIONS}
            placeholder="Select your status"
            onChange={onChange}
          />
        ) : field.kind === "maritalStatus" ? (
          // Same `SelectControl` the employment status uses, for the same
          // reason: a stored value off the canonical list is prepended and
          // stays selectable, so an alum whose record says something we no
          // longer offer sees it rather than an empty box (#647). Free text
          // until now, which is why staff read the field as "missing".
          <SelectControl
            id={controlId}
            value={value}
            options={MARITAL_STATUS_OPTIONS}
            placeholder="Select an option"
            onChange={onChange}
          />
        ) : field.kind === "industry" ? (
          <IndustryControl
            id={controlId}
            value={value}
            onFileValue={onFileValue}
            onChange={onChange}
            onBlur={onBlur}
            error={error}
            errorId={errorId}
          />
        ) : field.kind === "otherDesignations" ? (
          <OtherDesignationsControl
            id={controlId}
            labelId={labelId}
            helpId={helpId}
            value={value}
            onChange={onChange}
          />
        ) : (
          <>
            <div className="flex gap-2" role="radiogroup" aria-labelledby={labelId}>
              {["Yes", "No"].map((opt) => (
                <label
                  key={opt}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800"
                >
                  <input
                    type="radio"
                    name={controlId}
                    value={opt}
                    checked={value === opt}
                    onChange={() => onChange(opt)}
                    className="h-4 w-4 border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
                  />
                  {opt}
                </label>
              ))}
            </div>
            {field.donateUrl ? (
              <a
                href={field.donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                Donate to Pay It Forward
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </>
        )}
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- success ----- */

export function SuccessPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
        <Check className="h-7 w-7 text-success-600" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-navy-800">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
