/**
 * TEMPORARY: swap for components['schemas'][...] from api.gen.ts after regen.
 *
 * The api#661 "new people" survey types, written by hand from the shared
 * contract while the backend is still on its way to dev. Every component and
 * helper for this feature imports from THIS file and nowhere else, so once
 * `npm run gen:api-types` has the real schemas the swap is one file: replace
 * each alias below with `components["schemas"]["<SameName>"]`.
 *
 * `DuplicateWarning` and `SurveySupportContact` already exist in the generated
 * file, so they are taken from there now.
 */
import type { components } from "@/types/api.gen";

/** Which path the respondent picked on the first question. */
export type NewPersonKind = "alum" | "friend";

/**
 * ANY-OF groups: each inner list is satisfied when at least one of its keys is
 * non-blank. The server is the single source of truth for this list.
 */
export type NewPeopleRequiredFields = Record<NewPersonKind, string[][]>;

/** `GET /survey/new/{key}` */
export type NewPeopleSurveyInfo = {
  required_fields: NewPeopleRequiredFields;
  support_contact: components["schemas"]["SurveySupportContact"] | null;
};

/** `POST /survey/new/{key}` body. */
export type NewPersonSubmitRequest = {
  kind: NewPersonKind;
  fields: Record<string, string>;
  comments: string | null;
  fill_seconds: number | null;
  /** Honeypot: a hidden input a person never sees, so it must be "". */
  website: string;
};

/** `POST /survey/new/{key}` 200 response. */
export type NewPersonSubmitResult = { received: boolean };

/** `GET|PUT /survey/new-people/link`, `POST /survey/new-people/link/reissue` */
export type NewPeopleLinkRead = {
  enabled: boolean;
  key: string;
  updated_at: string;
};

export type NewPersonPossibleMatch = {
  alumni_id: number;
  name: string;
  graduation_year: number | null;
  is_friend: boolean;
  match_reason: "email" | "name";
};

/** One row of `GET /survey/new-people/submissions` (pending only, oldest first). */
export type NewPersonSubmissionItem = {
  submission_id: number;
  kind: NewPersonKind;
  /** ISO timestamp. Sent back on approve as the stale check. */
  submitted_at: string;
  name: string;
  email: string | null;
  fields: { field_key: string; label: string; value: string }[];
  comments: string | null;
  possible_matches: NewPersonPossibleMatch[];
};

/** `POST /survey/new-people/submissions/{id}/approve` body. */
export type NewPersonApproveRequest = {
  action: "create" | "merge";
  /** create only; null = use the submitted kind. */
  kind: NewPersonKind | null;
  /** merge only (required for merge). */
  alumni_id: number | null;
  submitted_at: string;
};

/** `POST /survey/new-people/submissions/{id}/approve` 200 response. */
export type NewPersonApproveResult = {
  alumni_id: number;
  created: boolean;
  duplicate_warnings: components["schemas"]["DuplicateWarning"][];
};
