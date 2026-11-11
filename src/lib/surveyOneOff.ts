/**
 * "Send survey" on an alum's profile (fa-web-api #669).
 *
 * Sends the normal survey email (same copy, same 7-day link, same day-7 and
 * day-14 reminders) to ONE alum. It is not the class campaign: the class send
 * still emails them later. The backend decides who can be sent to and why not;
 * these helpers only turn its answer into words for the button and the dialog.
 */
import type { components } from "@/types/api.gen";

export type SurveyOneOffPreview = components["schemas"]["SurveyOneOffPreview"];
export type SurveyOneOffResult = components["schemas"]["SurveyOneOffResult"];

export const SEND_SURVEY_LABEL = "Send survey";

/** "Nov 11, 2026", or null for a missing / unreadable date. */
export function formatSurveyDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Why the button is disabled, or null when it can be pressed. */
export function disabledReason(preview: SurveyOneOffPreview): string | null {
  if (preview.can_send) return null;
  return preview.reason?.trim() || "This person can't be sent the survey.";
}

/** "Last sent on Nov 4, 2026." — the re-send warning — or null if never sent. */
export function lastSentWarning(preview: SurveyOneOffPreview): string | null {
  const when = formatSurveyDate(preview.last_sent_at);
  return when ? `Last sent on ${when}.` : null;
}

/** "Replied on Oct 2, 2026." when they answered within the last year. */
export function lastRepliedNote(preview: SurveyOneOffPreview): string | null {
  const when = formatSurveyDate(preview.last_replied_at);
  return when ? `Replied on ${when}.` : null;
}

/** Which address it goes to, in words: "(work email)" when it isn't personal. */
export function emailSourceNote(source: string | null | undefined): string | null {
  return source === "work" ? "Work email. No personal email on file." : null;
}

export function sentToast(name: string, email: string): string {
  return `Survey sent to ${name} at ${email}.`;
}
