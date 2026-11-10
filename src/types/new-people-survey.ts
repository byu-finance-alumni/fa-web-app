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
  /**
   * merge only (round 2). A merge always fills BLANK fields; it replaces a
   * POPULATED field only when its key is listed here. Default: fill blanks only.
   */
  overwrite_fields?: string[];
};

/** `POST /survey/new-people/submissions/{id}/approve` 200 response. */
export type NewPersonApproveResult = {
  alumni_id: number;
  created: boolean;
  duplicate_warnings: components["schemas"]["DuplicateWarning"][];
  /** Round 2: e.g. "kind_mismatch" when the submitted kind differs from the record's. */
  warnings?: string[];
};

/**
 * `GET /survey/new-people/submissions/{id}/preview?alumni_id={id}` (round 2):
 * what a MERGE into that record would change.
 */
export type NewPersonMergePreview = {
  alumni_id: number;
  /** The existing record's name. */
  name: string;
  deceased: boolean;
  /** Only fields that would actually change. */
  changes: components["schemas"]["SurveyChange"][];
  /** Keys in `changes` whose `before` is non-blank: populated data a merge would replace. */
  overwrites: string[];
};

/** `POST /survey/new-people/submissions/reject` body (1–500 ids). */
export type NewPersonBulkRejectRequest = { submission_ids: number[] };

/** `POST /survey/new-people/submissions/reject` response. */
export type NewPersonBulkRejectResult = { rejected: number };
