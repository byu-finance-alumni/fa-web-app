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

import { Fragment, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink, Heart } from "lucide-react";

import { HeadshotCropper } from "@/components/alumni/HeadshotCropper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PAY_IT_FORWARD_URL } from "@/types/survey";
import { STATE_NAMES } from "@/lib/geo/state-field";
import { cn } from "@/lib/utils";
import { validateLinkedinUrl } from "@/lib/urlSafety";
import {
  CITY_MAX,
  COMPANY_NAME_MAX,
  COUNTRY_MAX,
  DETAILS_MAX,
  MAX_LINKS,
  ROLE_TYPE_OPTIONS,
  STATE_MAX,
  URL_MAX,
  addLinkEntry,
  removeLinkEntry,
  settleOpportunityUrl,
  todayIsoUtc,
  updateLinkEntry,
  validateLinkEntries,
  type LinkEntry,
  type LinkEntryErrors,
  type LinkRoleType,
} from "@/lib/opportunityLinks";
import {
  joinOtherDesignationSlots,
  splitOtherDesignationSlots,
} from "@/lib/designations";
import {
  waysToHelpCopy,
  type WaysToHelpMode,
} from "@/lib/surveyWaysToHelp";
import {
  COUNTRY_OPTIONS,
  INDUSTRY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PRIMARY_INDUSTRY_OPTIONS,
  SURVEY_EMPLOYMENT_STATUS_OPTIONS,
  isEmploymentStatusPlaceholder,
} from "@/constants/dropdowns";

export type Fields = Record<string, string>;

// Country dropdown options (#525) — the list itself moved to
// `constants/dropdowns.ts` (#440) once the staff Personal edit form regained the
// Residence country field: both entry points write `contact.country`, so they
// have to offer the same options. The app stores country as free text, so a
// stored value outside this list is still preserved by the select (see
// `SelectControl`). Same arrangement as `MARITAL_STATUS_OPTIONS` below.
export { COUNTRY_OPTIONS };

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
        helpText: "Anything else you hold, for example Series 7, Series 65, FRM.",
      },
    ],
  },
];

export const ENGAGEMENT_SECTION: Section = {
  id: "engagement",
  title: "Ways to get involved",
  blurb: "Optional: mentoring, speaking, giving",
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

/**
 * The involvement questions the WAYS-TO-HELP page asks (#755) — the WHOLE
 * `ENGAGEMENT_SECTION` list the edit flow uses, giving question included.
 *
 * Jake's call, 2026-08-25, asked explicitly: the Pay It Forward question stays
 * ON this page, with its donate button. His meeting note scoped the page to
 * "ways to get involved" and jobs/internships, and giving lives INSIDE the
 * section carrying that name — its own blurb reads "mentoring, speaking,
 * giving". The alumni who reach this page confirmed their details in one click,
 * so they are the most willing audience the survey ever has; asking them costs
 * nothing.
 *
 * Note the question is only worth asking WITH `donateUrl` rendered beneath it.
 * "Would you like to donate?" with no way to donate would recreate the exact
 * dead end #755 exists to remove.
 *
 * Aliased rather than hand-listed on purpose — the edit flow and this page ask
 * the same questions in the same order by construction, so a question added to
 * `ENGAGEMENT_SECTION` later cannot silently diverge between the two.
 */
export const WAYS_TO_HELP_FIELDS: EditField[] = ENGAGEMENT_SECTION.fields;

/**
 * The ONLY field keys the ways-to-help page may submit. Passed to
 * `answeredFields` so a payload from that page cannot carry a profile field the
 * page never showed — see `lib/surveyConfirm`.
 */
export const WAYS_TO_HELP_FIELD_KEYS: readonly string[] = WAYS_TO_HELP_FIELDS.map(
  (f) => f.key,
);

/**
 * The opportunity-links screen's id in the section menu (#441).
 *
 * A PSEUDO-SECTION, exactly like `"photo"`, and deliberately NOT a member of
 * `INFO_SECTIONS` / `EDIT_SECTIONS`. Those lists are the survey's FIELD
 * machinery: every entry is a `table.column` key that `submit_response` stages
 * and `apply_response` setattrs onto the alum's record, and
 * `sample-survey-parity.test.ts` binds them to the email's column picker and to
 * `SAMPLE_ALUM` on exactly that basis.
 *
 * An opportunity is not a column on the alum — it is a row in its own table,
 * several per alum, posted to its own endpoint
 * (`POST /survey/respond/{token}/links`) with its own moderation queue. Putting
 * it in those lists would fail the parity test for the right reason and, if
 * someone "fixed" that by inventing a sample value and an email row, would make
 * the staff email offer to show an alum "the opportunity link we have on file",
 * which is not a thing that exists. If you find yourself editing `SURVEY_FIELDS`
 * or `SAMPLE_ALUM` for this feature, stop: it belongs here instead.
 */
export const OPPORTUNITY_LINKS_SECTION_ID = "links";

export function initialsOf(name: string): string {
  return (
    name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() ||
    "?"
  );
}

/* ------------------------------------------------------------ review group -- */

/**
 * The review panel's sections, laid out as TWO INDEPENDENT STACKS (#689).
 *
 * It used to be a two-column grid, and a grid lays its items out in ROWS: every
 * row is as tall as its taller cell, so Employment (ten rows) sitting beside
 * Personal (twenty-one) left the left column blank from LinkedIn all the way
 * down to where Graduate school began. Two stacks share no rows, so a short
 * section is always followed immediately by the next one — the hole cannot come
 * back the next time a section grows or shrinks, and nothing is special-cased by
 * name.
 *
 * Which stack a section lands in is decided by WEIGHT, not by name: each section
 * goes to whichever column is shorter so far, so the two stay close to level as
 * fields come and go. The weight is only an estimate in review-panel rows, and
 * it does not need to be exact — a bad guess leaves one column a little longer
 * than the other, never a gap in the middle of one.
 *
 * `INFO_SECTIONS` itself is untouched: the section menu and the walkthrough
 * still read it in its own order, and below `sm:` this is one column again.
 */
export function reviewColumns(sections: Section[]): [Section[], Section[]] {
  const columns: [Section[], Section[]] = [[], []];
  const filled = [0, 0];
  for (const section of sections) {
    // One line for the section title, one per row `ReviewGroup` renders (spouse
    // first/last collapse into a single "Spouse name" row, so the last name does
    // not count), and one for each `groupLabel` subheading inside the section.
    const weight =
      1 +
      section.fields.filter((f) => f.key !== SPOUSE_LAST_NAME_KEY).length +
      section.fields.filter((f) => f.groupLabel).length;
    const target = filled[0] <= filled[1] ? 0 : 1;
    columns[target].push(section);
    filled[target] += weight;
  }
  return columns;
}

/**
 * The read-only "Your information" body, shared by the alum's review screen and
 * the staff Sample survey dialog so the two cannot drift (they render the same
 * component for the same reason this whole file exists).
 *
 * `className` is for the caller's own padding only — the real page has room for
 * `sm:px-6`, the preview dialog does not.
 */
export function ReviewSections({
  sections,
  fields,
  className,
}: {
  sections: Section[];
  fields: Fields;
  className?: string;
}) {
  const [left, right] = reviewColumns(sections);
  return (
    <div className={cn("grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2", className)}>
      <div className="space-y-5">
        {left.map((s) => (
          <ReviewGroup key={s.id} section={s} fields={fields} />
        ))}
      </div>
      <div className="space-y-5">
        {right.map((s) => (
          <ReviewGroup key={s.id} section={s} fields={fields} />
        ))}
      </div>
    </div>
  );
}


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
  links,
  setLinks,
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
  /**
   * The opportunity links the alum is offering (#441). Owned by the CALLER, not
   * by this component, for the same reason the photo file is: they are sent by a
   * SEPARATE token-gated call (`POST /survey/respond/{token}/links`), so the
   * screen that collects them must not also be the thing that decides when they
   * are posted. The staff preview passes plain local state and posts nothing.
   */
  links: LinkEntry[];
  setLinks: (next: LinkEntry[]) => void;
  onBack: () => void;
  /**
   * Everything the alum typed is valid — go FORWARD (#773).
   *
   * This no longer means "post it": since #773 the caller advances to the
   * ways-to-help step, and the single POST happens from there, carrying the
   * edits and any involvement answers in one body. That is what keeps the alum
   * to one response row — a second POST for the involvement answers would stage
   * a second pending row beside the first, which is what the backend does with
   * two submissions on one token, on purpose. See `editSubmitBody`.
   */
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const section =
    openSection === "photo" || openSection === OPPORTUNITY_LINKS_SECTION_ID
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

  // Opportunity-link complaints, keyed by entry id then field (#441). Kept
  // separate from `fieldErrors` because the two are shaped differently — a link
  // entry has its own set of fields and there can be up to ten of them — and
  // because they are gated differently: link entries are NOT `touched`-gated.
  // Nothing is pre-filled here (an alum types every one of these from scratch),
  // so there is no legacy value to protect and every complaint is about
  // something typed in this session.
  const [linkErrors, setLinkErrors] = useState<Record<string, LinkEntryErrors>>(
    {},
  );

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
    // The links go out as their OWN request, and that request is all-or-nothing
    // server-side: one bad url 422s the whole batch. Checking here is what turns
    // "something in your submission was rejected" into a message under the box
    // that caused it. It is a courtesy, not a gate the backend relies on — see
    // `lib/opportunityLinks`.
    const linkFound = validateLinkEntries(links);
    setLinkErrors(linkFound);

    const firstBad = Object.keys(found)[0];
    if (!firstBad) {
      // Fields are clean; links decide. Opening their section puts the alum on
      // the entry with the message under it, the same way a bad field does.
      if (Object.keys(linkFound).length > 0) {
        openSectionNav(OPPORTUNITY_LINKS_SECTION_ID);
        return;
      }
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
        ) : openSection === OPPORTUNITY_LINKS_SECTION_ID ? (
          <OpportunityLinksSection
            entries={links}
            setEntries={setLinks}
            errors={linkErrors}
            clearError={(entryId, field) =>
              setLinkErrors((prev) => {
                const entry = prev[entryId];
                if (!entry?.[field]) return prev;
                const nextEntry = { ...entry };
                delete nextEntry[field];
                const updated = { ...prev };
                if (Object.keys(nextEntry).length > 0) updated[entryId] = nextEntry;
                else delete updated[entryId];
                return updated;
              })
            }
            // The other half of `clearError`, for the on-blur URL check: a
            // complaint can now be RAISED between edits, not only at submit.
            setError={(entryId, field, message) =>
              setLinkErrors((prev) => ({
                ...prev,
                [entryId]: { ...(prev[entryId] ?? {}), [field]: message },
              }))
            }
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
          submit. Our team reviews updates before they&apos;re applied.
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
        {/*
          Last in the menu, and rendered from this list rather than from
          `EDIT_SECTIONS`, because it is not a field section (#441) — see
          `OPPORTUNITY_LINKS_SECTION_ID`. It sits after "Ways to get involved"
          on purpose: both are optional offers rather than corrections to a
          record, and the required work is everything above them.
        */}
        <SectionRow
          title="Jobs & internships"
          blurb="Optional: share an opening students can apply to"
          onClick={() => openSectionNav(OPPORTUNITY_LINKS_SECTION_ID)}
        />
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
        The forward block (#648). This is a COMPLETION-RATE problem, not a colour
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
          4. WORDING — "Continue" since #773, and the line under it says what
             happens next.

        Colour is deliberately last. It is the weakest of the four on its own,
        and the reason the old navy button "blended in" was never really its hue
        — it was a same-size button in a row of buttons.

        ⚠️ IT SAYS "CONTINUE" BECAUSE IT NO LONGER SUBMITS (#773). One more
        screen follows — the involvement questions and jobs/internships every
        alum now ends on — and the POST happens there, carrying the edits and
        those answers in one body so the alum ends with one response row. A
        button that said "Submit my updates" and then showed another page would
        be the #648 failure in a new shape: the alum who believes they are done
        closes the tab, and everything they typed is lost. The label is
        load-bearing; do not "restore" the old wording without moving the POST
        back to this press. The explanatory line that used to sit under this
        button was cut on Jake's review (2026-08-28); the "not sent yet" warning
        it carried now sits on the next screen, directly above the button that
        does the sending (`WaysToHelpCopy.submitNote`).
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
          Continue
        </Button>
      </div>

      <TrustNote />
    </>
  );
}

/* ------------------------------------------------------- ways to help ----- */

/**
 * The survey's ENDING — both branches of the fork reach it.
 *
 * Where "Yes, everything is correct" leads (#755), and, since #773, where the
 * edit flow's Continue leads too. The problem it replaces: confirming rendered
 * a `SuccessPanel` whose only control was "I need to make changes", and the
 * edit flow ended on a thank-you. Both of the survey's asks — involvement and
 * jobs/internships — were choices in the edit MENU, so the alumni with nothing
 * to correct were never asked at all, and the alumni who came to fix one field
 * opened that one section and never saw them either. This screen is that ask,
 * on both of the paths alumni actually take.
 *
 * ONE screen for both branches on purpose, rendering `WAYS_TO_HELP_FIELDS`
 * (itself an alias of `ENGAGEMENT_SECTION.fields`), so the two paths cannot
 * drift into asking different questions. `mode` changes the COPY and nothing
 * else — see `lib/surveyWaysToHelp`, where the difference is spelled out: on
 * the confirm branch the alum's reply is already recorded, on the edit branch
 * their updates are still in the browser and this page's button is what sends
 * them.
 *
 * What it is NOT:
 *
 *  * NOT a field editor. It renders the involvement questions and the
 *    opportunity-links form, and nothing else. Names, employers and contact
 *    details are not on this page — the alum has just been through them.
 *  * NOT a dead end either. The way back sits directly under the intro, because
 *    an alum who arrived by mistake, or who has one more change to make, must
 *    not have to read a page of asks before finding the way out.
 *  * NOT gated on having answered anything. Submit works with the page
 *    untouched on both branches — see `waysToHelpThanksBody` and
 *    `waysToHelpCopy`, which say what actually happened rather than claiming
 *    something that didn't.
 *
 * No shell, no `<main>`, no footer: the caller wraps this in `SurveyPageShell`,
 * which already provides all three.
 */
export function WaysToHelp({
  firstName,
  mode = "confirmed",
  valueOf,
  setEdit,
  links,
  setLinks,
  onNeedChanges,
  onSubmit,
  submitting,
  submitError,
}: {
  firstName: string;
  /**
   * Which branch the alum arrived on (#773). Defaults to `confirmed`, the
   * branch that has been shipping since #755, so the ways-to-help ROUTE keeps
   * its behaviour without passing anything.
   */
  mode?: WaysToHelpMode;
  valueOf: (key: string) => string;
  setEdit: (key: string, value: string) => void;
  /** Owned by the caller, like the edit flow's: they go to their OWN endpoint. */
  links: LinkEntry[];
  setLinks: (next: LinkEntry[]) => void;
  /**
   * The way back into the edit flow. On the confirm branch that is the review
   * screen ("I need to make changes"); on the edit branch it is the section
   * menu the alum just came from, with everything they typed still in it.
   */
  onNeedChanges: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const copy = waysToHelpCopy(mode, firstName);
  // Same shape and the same rules as the edit flow's, for the same reason: the
  // links batch is all-or-nothing server-side, so a bad value is worth catching
  // under the box that caused it rather than as "something was rejected".
  const [linkErrors, setLinkErrors] = useState<Record<string, LinkEntryErrors>>(
    {},
  );

  // The involvement questions need no gate of their own — every one is a Yes/No
  // radio, so there is no value an alum can type wrong.
  const handleSubmit = () => {
    const found = validateLinkEntries(links);
    setLinkErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit();
  };

  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-navy-800">
          {copy.heading}
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-gray-600">
          {copy.intro}
        </p>
        {/*
          The escape hatch, ABOVE the asks rather than buried under them. Someone
          who pressed the wrong button has already been told their details are
          right; making them scroll past two requests for their time to correct
          that is the same trap in a different shape. On the edit branch it is
          the same button doing the same job — back to the form, with everything
          they typed still in it.
        */}
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onNeedChanges}
            disabled={submitting}
          >
            {copy.backLabel}
          </Button>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="ways-to-help-involvement">
        <h2
          id="ways-to-help-involvement"
          className="text-lg font-semibold text-navy-800"
        >
          Ways to get involved
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-gray-500">
          Say yes to anything you&apos;d be open to. Nothing here commits you to
          a date. Someone from the Finance team gets in touch first.
        </p>
        <div className="mt-4 space-y-5 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
          {WAYS_TO_HELP_FIELDS.map((f) => (
            <FieldControl
              key={f.key}
              field={f}
              value={valueOf(f.key)}
              onChange={(v) => setEdit(f.key, v)}
            />
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="ways-to-help-links">
        <OpportunityLinksSection
          headingAs="h2"
          headingId="ways-to-help-links"
          entries={links}
          setEntries={setLinks}
          errors={linkErrors}
          clearError={(entryId, field) =>
            setLinkErrors((prev) => {
              const entry = prev[entryId];
              if (!entry?.[field]) return prev;
              const nextEntry = { ...entry };
              delete nextEntry[field];
              const updated = { ...prev };
              if (Object.keys(nextEntry).length > 0) updated[entryId] = nextEntry;
              else delete updated[entryId];
              return updated;
            })
          }
          setError={(entryId, field, message) =>
            setLinkErrors((prev) => ({
              ...prev,
              [entryId]: { ...(prev[entryId] ?? {}), [field]: message },
            }))
          }
        />
      </section>

      {/*
        Navy on BOTH branches, not the survey's `submit-green` button. That
        green is a documented single-control exception in UX-UI.md — the edit
        flow's forward button, which an alum reaches only after filling a long
        form and can miss. This button sits at the end of a short page that is
        the only thing on screen, and it is the only control in its block;
        UX-UI.md is explicit that a second control wanting `submit-green` should
        take `brand-blue`/navy instead. Keeping the exception on exactly one
        button is the whole reason it is allowed to exist.
      */}
      <div className="mt-10 border-t border-gray-200 pt-8">
        {submitError ? (
          <p className="mb-4 text-sm text-danger-600">{submitError}</p>
        ) : null}
        {/*
          ABOVE the button, not under it: this is the only thing telling an
          editing alum that what they typed is still in the browser, and the
          press right below it is what sends it. `null` on the confirm branch,
          which has nothing unsent.
        */}
        {copy.submitNote ? (
          <p className="mb-3 text-base font-semibold leading-relaxed text-navy-800">
            {copy.submitNote}
          </p>
        ) : null}
        <Button
          type="button"
          variant="navy"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? copy.submittingLabel : copy.submitLabel}
        </Button>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          {copy.footerNote}
        </p>
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
              JPG, PNG, or WebP. You&apos;ll position it in the circle. Replaces
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

/* ------------------------------------------------- opportunity links (#441) - */

/**
 * "Jobs & internships" — the alum offers openings at their company or anywhere
 * else, and staff work the resulting list from the Links tab.
 *
 * ⚠️ THIS IS THE APP'S ONLY PUBLIC WRITE OF A URL THAT LATER BECOMES A CLICKABLE
 * LINK ON A STAFF SCREEN. Nothing on this screen is a security control. The
 * inline rules come from `lib/opportunityLinks`, which mirrors the server's
 * validators so an alum reads a specific message instead of meeting a 422 that
 * names none of their ten entries; the backend validates every field again on
 * the persistence path, and the staff render side scheme-checks the STORED value
 * before putting it in an `href`. Do not move a rule here from there.
 *
 * Deliberately NOT a `Section` (see `OPPORTUNITY_LINKS_SECTION_ID`): these are
 * rows in their own table posted to their own endpoint, not `table.column`
 * answers, so they stay out of the survey's field/email/sample three-list
 * machinery entirely.
 *
 * Mobile-first, like the rest of this page — one column of full-width controls,
 * pairs only splitting at `sm:`, and every tap target a real button rather than
 * an icon. The alum meeting this screen is on a phone, in an email client's
 * browser, and will not fight a dense grid.
 */
export function OpportunityLinksSection({
  entries,
  setEntries,
  errors,
  clearError,
  setError,
  headingAs = "h1",
  headingId,
}: {
  entries: LinkEntry[];
  setEntries: (next: LinkEntry[]) => void;
  errors: Record<string, LinkEntryErrors>;
  clearError: (entryId: string, field: keyof LinkEntryErrors) => void;
  setError: (
    entryId: string,
    field: keyof LinkEntryErrors,
    message: string,
  ) => void;
  /**
   * `h1` in the edit flow, where this screen IS the page (#441); `h2` on the
   * ways-to-help page (#755), where it is the second of two asks under that
   * page's own heading. The wording is identical either way — only the level
   * and its type scale change, because two `h1`s on one screen leaves a screen
   * reader with two competing page titles.
   */
  headingAs?: "h1" | "h2";
  headingId?: string;
}) {
  const Heading = headingAs;
  const asPage = headingAs === "h1";
  const atCap = entries.length >= MAX_LINKS;

  // Today, for every deadline picker's floor. Resolved once here and after
  // mount, not during render: this page is client-rendered but Next still
  // renders it on the server, and a request straddling UTC midnight would
  // hydrate a `min` that disagrees with the one already in the markup. The rule
  // does not depend on it — `validateLinkEntries` re-checks against a fresh
  // clock on submit — so the first frame going without costs nothing.
  const [minDeadline, setMinDeadline] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMinDeadline(todayIsoUtc());
  }, []);

  return (
    <>
      <Heading
        id={headingId}
        className={
          asPage
            ? "text-3xl font-semibold leading-tight tracking-tight text-navy-800"
            : "text-lg font-semibold text-navy-800"
        }
      >
        Jobs &amp; internships
      </Heading>
      <p
        className={
          asPage
            ? "mt-3 max-w-prose text-base leading-relaxed text-gray-600"
            : "mt-1 max-w-prose text-sm leading-relaxed text-gray-500"
        }
      >
        Know of a job or internship our students should see? Share the link. Our
        team reviews everything before it&apos;s shared.
      </p>

      <div className="mt-6 space-y-6">
        {entries.map((entry, index) => (
          <OpportunityLinkCard
            key={entry.id}
            entry={entry}
            index={index}
            // The remove control is hidden on a lone untouched row: there is
            // nothing to remove, and offering it invites the alum to empty a
            // section they only just opened.
            canRemove={entries.length > 1}
            errors={errors[entry.id] ?? {}}
            minDeadline={minDeadline}
            onChange={(patch, cleared) => {
              setEntries(updateLinkEntry(entries, entry.id, patch));
              if (cleared) clearError(entry.id, cleared);
            }}
            onFieldError={(field, message) => {
              if (message) setError(entry.id, field, message);
              else clearError(entry.id, field);
            }}
            onRemove={() => setEntries(removeLinkEntry(entries, entry.id))}
          />
        ))}
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={atCap}
          onClick={() => setEntries(addLinkEntry(entries))}
        >
          Add another opportunity
        </Button>
        {atCap ? (
          <p className="mt-2 text-xs text-gray-500">
            You can share up to {MAX_LINKS} at a time. Send these first and
            you&apos;re welcome to tell us about more.
          </p>
        ) : null}
      </div>
    </>
  );
}

/** One opportunity. Its own bordered card, so ten of them stay tellable apart. */
function OpportunityLinkCard({
  entry,
  index,
  canRemove,
  errors,
  minDeadline,
  onChange,
  onFieldError,
  onRemove,
}: {
  entry: LinkEntry;
  index: number;
  canRemove: boolean;
  errors: LinkEntryErrors;
  /** `yyyy-mm-dd` floor for the deadline picker, once the client knows today. */
  minDeadline?: string;
  /** `cleared` names the field whose complaint this edit answers, if any. */
  onChange: (
    patch: Partial<Omit<LinkEntry, "id">>,
    cleared?: keyof LinkEntryErrors,
  ) => void;
  /** Raise (or, with `null`, drop) one field's complaint between edits. */
  onFieldError: (field: keyof LinkEntryErrors, message: string | null) => void;
  onRemove: () => void;
}) {
  const base = `survey-link-${entry.id}`;

  /**
   * The link box, once the alum's finger leaves it.
   *
   * NORMALISE, then judge. `jakegunnell.com` is written back as
   * `https://jakegunnell.com/` — the value that will actually be sent, shown in
   * the box rather than sprung on anyone later — and a link that cannot be
   * rescued is named right there instead of surviving to the end of the survey.
   * On a phone, where this whole page lives, finding out at blur is the
   * difference between one correction and a scroll back through ten cards.
   *
   * A blank box settles silently: an alum who tapped into a row and out again
   * has not made a mistake yet, and the blank row is dropped on submit anyway.
   */
  const settleUrl = () => {
    if (entry.url.trim() === "") {
      onFieldError("url", null);
      return;
    }
    const { value, error } = settleOpportunityUrl(entry.url);
    if (value !== entry.url) onChange({ url: value });
    onFieldError("url", error);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-800">
          Opportunity {index + 1}
        </h2>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
            onClick={onRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-5">
        {/*
          "This is my company" means "look the name up from my employment
          record", so the typed-name input is REPLACED rather than disabled: the
          server refuses a batch that sends both (its `_company_identity`
          validator), and a greyed-out box beside a ticked one is an invitation
          to type into it and wonder why the answer vanished. The lookup happens
          at read time, so the list follows the alum's job changes instead of
          freezing the name they typed today.

          Anything already typed is KEPT in state rather than cleared —
          `linksToSubmit` drops it while the box is ticked, so it costs nothing,
          and an accidental tick doesn't delete a company name the alum then has
          to type again.
        */}
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800">
          <input
            id={`${base}-own`}
            type="checkbox"
            checked={entry.isOwnCompany}
            onChange={(e) =>
              onChange({ isOwnCompany: e.target.checked }, "companyName")
            }
            className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          />
          This opening is at my company
        </label>

        {entry.isOwnCompany ? (
          <p className="text-xs leading-relaxed text-gray-500">
            We&apos;ll list it under the employer on your record, so it stays
            right if you change jobs.
          </p>
        ) : (
          <LinkField
            id={`${base}-company`}
            label="Company"
            required
            error={errors.companyName}
          >
            {(props) => (
              <Input
                {...props}
                value={entry.companyName}
                maxLength={COMPANY_NAME_MAX}
                placeholder="Who is hiring?"
                onChange={(e) =>
                  onChange({ companyName: e.target.value }, "companyName")
                }
              />
            )}
          </LinkField>
        )}

        {/*
          `type="url"` for the same reason the LinkedIn field uses it: on a phone
          it gets a keyboard with "/" and ".com" on it, which is most of why a
          typed URL comes out malformed. `maxLength` mirrors the column so the
          box stops rather than the server refusing what was typed.
        */}
        <LinkField
          id={`${base}-url`}
          label="Link to the posting"
          required
          error={errors.url}
          help="The application page, the job posting, or your company's careers page. A plain address like jakegunnell.com works too."
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              inputMode="url"
              value={entry.url}
              maxLength={URL_MAX}
              placeholder="https://careers.example.com/jobs/1234"
              onChange={(e) => onChange({ url: e.target.value }, "url")}
              onBlur={settleUrl}
            />
          )}
        </LinkField>

        <LinkField
          id={`${base}-role`}
          label="Internship or full-time?"
          required
          error={errors.roleType}
        >
          {({ className, ...props }) => (
            <select
              {...props}
              value={entry.roleType}
              className={className ? `${SELECT_CLASS} ${className}` : SELECT_CLASS}
              onChange={(e) =>
                onChange(
                  { roleType: e.target.value as LinkRoleType | "" },
                  "roleType",
                )
              }
            >
              <option value="">Select one</option>
              {ROLE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </LinkField>

        {/*
          Text-only toggle, like every control on this page. A checkbox rather
          than two buttons because it is one binary fact about the job.

          FLIPPING IT LOSES NOTHING. The picked state and the typed region are
          two different slots on the entry, so a state chosen and then abandoned
          is still there on the way back, and `linksToSubmit` sends only the one
          belonging to the mode on screen. Same principle as the "at my company"
          box above: an accidental tap never deletes an answer.
        */}
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 transition-colors hover:border-brand-blue-500 has-[:checked]:border-brand-blue-600 has-[:checked]:bg-brand-blue-50 has-[:checked]:font-medium has-[:checked]:text-navy-800">
          <input
            id={`${base}-outside-us`}
            type="checkbox"
            checked={entry.isOutsideUS}
            onChange={(e) => {
              onChange({ isOutsideUS: e.target.checked }, "state");
              // The country box comes and goes with this; a message about a
              // field that just left the screen has nothing to point at.
              onFieldError("country", null);
            }}
            className="h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
          />
          This job is outside the United States
        </label>

        {/* Stacked on a phone, paired from `sm:` — the same breakpoint the rest
            of this page splits at. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <LinkField id={`${base}-city`} label="City" error={errors.city}>
            {(props) => (
              <Input
                {...props}
                value={entry.city}
                maxLength={CITY_MAX}
                placeholder="Where is the job?"
                onChange={(e) => onChange({ city: e.target.value }, "city")}
              />
            )}
          </LinkField>
          {entry.isOutsideUS ? (
            <LinkField
              id={`${base}-region`}
              label="Region or province"
              error={errors.state}
            >
              {(props) => (
                <Input
                  {...props}
                  value={entry.region}
                  maxLength={STATE_MAX}
                  placeholder="e.g. Ontario"
                  onChange={(e) => onChange({ region: e.target.value }, "state")}
                />
              )}
            </LinkField>
          ) : (
            <LinkField id={`${base}-state`} label="State" error={errors.state}>
              {(props) => (
                // The same state list the Employment section offers, so the two
                // spellings staff filter on stay one spelling. A dropdown also
                // takes the free-text character rules out of play here entirely.
                <SelectControl
                  {...props}
                  value={entry.state}
                  options={STATE_NAMES}
                  placeholder="Select a state"
                  onChange={(v) => onChange({ state: v }, "state")}
                />
              )}
            </LinkField>
          )}
        </div>

        {entry.isOutsideUS ? (
          <LinkField
            id={`${base}-country`}
            label="Country"
            error={errors.country}
          >
            {(props) => (
              <Input
                {...props}
                value={entry.country}
                maxLength={COUNTRY_MAX}
                placeholder="e.g. Canada"
                onChange={(e) => onChange({ country: e.target.value }, "country")}
              />
            )}
          </LinkField>
        ) : null}

        <LinkField
          id={`${base}-deadline`}
          label="Application deadline"
          help="Optional. Leave blank if it's open until filled."
          error={errors.deadline}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={entry.deadline}
              // Discourages a past date in the picker itself. The rule is
              // enforced by `validateLinkEntries` on submit, mirroring the
              // server: today is accepted, only earlier is refused.
              min={minDeadline}
              onChange={(e) => onChange({ deadline: e.target.value }, "deadline")}
            />
          )}
        </LinkField>

        <LinkField
          id={`${base}-details`}
          label="Anything else students should know"
          error={errors.details}
          help="Optional: timing, the team, who to mention, how to apply."
        >
          {(props) => (
            <Textarea
              {...props}
              value={entry.details}
              maxLength={DETAILS_MAX}
              rows={3}
              placeholder="Summer 2027 analyst program, applications open now…"
              onChange={(e) => onChange({ details: e.target.value }, "details")}
            />
          )}
        </LinkField>
      </div>
    </div>
  );
}

/**
 * Label + control + inline message for one opportunity field.
 *
 * Deliberately NOT `FieldControl`: that one is driven by an `EditField` with a
 * `table.column` key and a `FieldKind`, and giving these inputs fake field keys
 * to borrow its markup is how a non-column value ends up looking like a column
 * to the next reader. This renders the same label/help/error markup over a
 * render-prop child, which is a few lines and keeps the two models apart.
 */
function LinkField({
  id,
  label,
  required,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
    className?: string;
  }) => React.ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium text-gray-900">
        {label}
        {required ? (
          <span className="ml-1 text-danger-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {help ? (
        <p id={helpId} className="mt-0.5 text-xs leading-relaxed text-gray-500">
          {help}
        </p>
      ) : null}
      <div className="mt-1.5">
        {children({
          id,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": errorId ?? helpId,
          className: error
            ? "border-danger-600 focus-visible:ring-danger-600"
            : undefined,
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
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
  className,
  ...aria
}: {
  id: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  onChange: (v: string) => void;
  /** Appended to the shared select styling — the error border, in practice. */
  className?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}) {
  const opts = withStoredValue(options, value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ? `${SELECT_CLASS} ${className}` : SELECT_CLASS}
      {...aria}
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
                : "We can only save industries from the list above. If yours isn't there, pick the closest match."}
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
