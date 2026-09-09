/**
 * The survey EMAIL copy — subject, intro, closing, and which on-file fields the
 * email previews — as the BACKEND holds it (#524).
 *
 * WHAT THIS REPLACED, AND WHY IT MATTERS. This copy used to live in
 * `localStorage` (`src/lib/surveyStore.ts`, now deleted). It was therefore
 * per-browser and per-machine: Tanya editing the intro on her laptop changed
 * nothing Amy could see, and — the actual complaint — changed nothing a single
 * alum ever received, because the real send used copy hardcoded in the API. The
 * editor looked like it saved, and did, to a place with no readers.
 *
 * That is the SAME defect class as #574, recorded in the file this one
 * supersedes: a parallel, staff-authored copy of something the send path never
 * read, drifting silently from what alumni actually got. So there is now exactly
 * one home for this text — the server — and nothing here caches, mirrors or
 * defaults it locally. If the server cannot be read, the editor says so; it does
 * not fall back to a frontend copy of the wording, because a fallback IS a
 * second source of truth wearing a hat.
 *
 * Consequently there are no DEFAULT_* constants in this module. "Restore the
 * standard wording" is a request to the backend (`POST /survey/message/reset`),
 * whose defaults are the ones the send path uses.
 */

import type { components } from "@/types/api.gen";

/*
 * ────────────────────────────────────────────────────────────────────────────
 * TYPES COME FROM THE GENERATED SCHEMA.
 *
 * `SurveyMessageRead` / `SurveyMessageUpdate` are re-exported from
 * `src/types/api.gen.ts`, which is generated from the backend's OpenAPI schema
 * and guarded against drift by CI. They were hand-written mirrors while the
 * backend was being built in parallel; the swap to generated types was the
 * check that the frozen contract had actually been honoured on both sides.
 * Never hand-edit `api.gen.ts` — regenerate it with `npm run gen:api-types`.
 */

/** `GET /survey/message`, and the response of both writes. */
export type SurveyMessageRead = components["schemas"]["SurveyMessageRead"];

/** Body of `PUT /survey/message`. */
export type SurveyMessageUpdate = components["schemas"]["SurveyMessageUpdate"];

/** `GET` / `PUT` the one survey message. */
export const SURVEY_MESSAGE_PATH = "/survey/message";

/** `POST` — restore the backend's built-in wording and field selection. */
export const SURVEY_MESSAGE_RESET_PATH = "/survey/message/reset";

/**
 * The editable half of a read, i.e. the draft an editor starts from.
 *
 * The ONE place the read shape and the write shape meet. Keeping it a real
 * function rather than an inline spread means a backend rename fails the
 * typecheck here, loudly, instead of shipping a 422 nobody meets until they
 * press Save (the lesson from the alert-template card).
 */
export function toSurveyMessageUpdate(
  message: SurveyMessageRead,
): SurveyMessageUpdate {
  return {
    subject: message.subject,
    intro: message.intro,
    closing: message.closing,
    on_file_fields: [...message.on_file_fields],
  };
}

/** Whether `draft` differs from what the server last confirmed it stored. */
export function surveyMessageDirty(
  draft: SurveyMessageUpdate | null,
  saved: SurveyMessageRead | null,
): boolean {
  if (!draft || !saved) return false;
  return (
    draft.subject !== saved.subject ||
    draft.intro !== saved.intro ||
    draft.closing !== saved.closing ||
    !sameFields(draft.on_file_fields, saved.on_file_fields)
  );
}

/** Field selection compared in ORDER — the order is the order of the email. */
function sameFields(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * The one thing wrong with a draft, in words, or null when it is sendable.
 *
 * A PRE-FLIGHT, not the validation: it exists to save a round trip. The backend
 * re-validates whatever it is handed and its refusal is what actually keeps a
 * broken email out of an inbox. Deliberately no length caps — the backend owns
 * those numbers, and a guessed limit here would refuse copy the API would have
 * accepted (or pass copy it rejects, which is worse).
 */
export function surveyMessageProblem(
  draft: SurveyMessageUpdate,
): string | null {
  if (!draft.subject.trim()) return "The subject line can't be empty.";
  if (!draft.intro.trim()) return "The message can't be empty.";
  if (!draft.closing.trim()) return "The closing can't be empty.";
  return null;
}

/**
 * "Whose copy is live", for the line under the editor's heading.
 *
 * The point of #524 is that Tanya and Amy now share ONE message instead of each
 * seeing their own browser's, so who last changed it has to be on screen — two
 * people editing the same paragraph need to know they are doing it.
 */
export function surveyMessageByline(
  message: SurveyMessageRead | null,
): string {
  if (!message) return "";
  const who = message.updated_by_email?.trim();
  const when = formatSurveyMessageTime(message.updated_at);
  if (!message.is_customized && !who) {
    return "This is the standard wording. Nobody has changed it.";
  }
  if (who && when) return `Last saved by ${who} on ${when}.`;
  if (who) return `Last saved by ${who}.`;
  if (when) return `Last saved on ${when}.`;
  return "Edited from the standard wording.";
}

/**
 * An ISO datetime as a readable local time, or null if it is unusable.
 *
 * ⚠️ A datetime with NO timezone offset is read as UTC, not as local time.
 * FastAPI serializes a naive `datetime` without a suffix, and `new Date()` would
 * treat that as the READER's zone — showing a Utah staffer a save timestamp
 * hours off, in a line whose entire job is telling two people who edited what
 * and when.
 */
export function formatSurveyMessageTime(iso: string | null): string | null {
  if (!iso) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim());
  const parsed = new Date(hasZone ? iso : `${iso.trim()}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

/** How the one-line status under the editor should read. */
export type SurveyMessageStatusTone = "error" | "warning" | "success" | "muted";

export interface SurveyMessageStatus {
  tone: SurveyMessageStatusTone;
  /** Empty string means "say nothing" — the only case is a read-only viewer. */
  text: string;
}

/**
 * The editor's saved / unsaved / failed line.
 *
 * ALWAYS RESOLVES TO SOMETHING for an editor. "Updating the survey message is
 * not saving" was reported because the old dialog said nothing either way, so a
 * lost edit and a stored one looked identical. A state with no words is the
 * defect, which is why this is a total function over the four inputs rather
 * than a chain of conditionals inline in the JSX — and why it is tested.
 *
 * Order matters: a failure outranks everything (it is the thing the user must
 * act on), then the reason Save is refusing to run, then unsaved work, and only
 * then the confirmation.
 */
export function surveyMessageStatus(input: {
  /** A failed save/reset, already in user-facing words. */
  error: string | null;
  /** Why the draft can't be sent yet, from {@link surveyMessageProblem}. */
  problem: string | null;
  dirty: boolean;
  /** The write that just succeeded, if the draft is untouched since. */
  justSaved: "save" | "reset" | null;
  /** False for a read-only viewer, who has no saved/unsaved state to report. */
  editable: boolean;
}): SurveyMessageStatus {
  if (input.error) return { tone: "error", text: input.error };
  if (input.problem) return { tone: "error", text: input.problem };
  if (input.dirty) {
    return {
      tone: "warning",
      text: "Edited, not saved. Alumni still get the saved wording.",
    };
  }
  if (input.justSaved === "reset") {
    return {
      tone: "success",
      text: "Restored. Everyone sees the standard wording again.",
    };
  }
  if (input.justSaved === "save") {
    return { tone: "success", text: "Saved. Everyone sees this wording now." };
  }
  return {
    tone: "muted",
    text: input.editable ? "No unsaved changes." : "",
  };
}

/** What the user is trying to do, for the wording of a failure. */
export type SurveyMessageAction = "load" | "save" | "reset";

/**
 * A failed request in words the staff can act on.
 *
 * Never repeats the backend's own error text: this app holds alumni records and
 * upstream messages can carry table names and internal URLs (see
 * `lib/loadError.ts` for the same rule). A 403 is phrased as the permission
 * answer it is, so the editor can go read-only instead of looking broken.
 */
export function surveyMessageError(
  status: number | null,
  action: SurveyMessageAction,
): string {
  if (status === 401) {
    return "Your session has ended. Sign in again to edit the email message.";
  }
  if (status === 403) {
    return "Your account can read the email message but not change it.";
  }
  if (status === 429) {
    return "Too many changes at once. Wait a moment and try again.";
  }
  if (status === 422) {
    return "The backend refused that wording. Check the subject, message and closing, then save again.";
  }
  if (action === "load") {
    return status === null
      ? "Couldn't reach the API to load the email message."
      : `Couldn't load the email message (${status}).`;
  }
  if (action === "reset") {
    return status === null
      ? "Couldn't reach the API. The standard wording was not restored."
      : `Couldn't restore the standard wording (${status}). Nothing was changed.`;
  }
  return status === null
    ? "Couldn't reach the API. Your changes are NOT saved."
    : `Couldn't save the email message (${status}). Your changes are NOT saved.`;
}
