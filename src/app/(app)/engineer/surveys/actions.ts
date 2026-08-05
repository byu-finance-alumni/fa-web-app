"use server";

import { revalidatePath } from "next/cache";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import type { components, operations } from "@/types/api.gen";

/**
 * One graduation year's survey campaign, straight off the generated OpenAPI
 * (never hand-written) so it stays in lockstep with the backend contract.
 */
export type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];

/** What the kill switch actually stopped — count + the years it cancelled. */
export type CancelAllResult =
  operations["cancel_all_survey_schedules_survey_schedules_cancel_all_post"]["responses"][200]["content"]["application/json"];

/** What the blanket pause actually held — count + the years it paused. */
export type PauseAllResult =
  operations["pause_all_survey_schedules_survey_schedules_pause_all_post"]["responses"][200]["content"]["application/json"];

/**
 * Every survey campaign, newest cohort first. The engineer console reads the
 * same list the Needs Surveying console does — it carries the status, start
 * date, who created it, and the per-stage sent counts the oversight view needs,
 * so there's no separate engineer read endpoint. Callers catch ApiError.
 */
export async function getSurveySchedules(): Promise<SurveyScheduleItem[]> {
  return apiGet<SurveyScheduleItem[]>("/survey/schedules");
}

/**
 * Stop EVERY running (scheduled/active) campaign. Engineer-only — the backend
 * re-enforces RequireEngineer on POST /survey/schedules/cancel-all; this action
 * only drives the request and hands the result back so the UI can report the
 * real count instead of assuming success.
 */
export async function stopAllSurveys(): Promise<
  { result: CancelAllResult } | { error: string }
> {
  let result: CancelAllResult;
  try {
    result = await apiPost<CancelAllResult>(
      "/survey/schedules/cancel-all",
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to stop the active surveys.",
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * Pause EVERY running (scheduled/active) campaign. The REVERSIBLE twin of
 * `stopAllSurveys` — every year it names can be resumed and picks its cadence
 * up where it left off, so nothing is destroyed. Engineer-only; the backend
 * re-enforces RequireEngineer on POST /survey/schedules/pause-all.
 */
export async function pauseAllSurveys(): Promise<
  { result: PauseAllResult } | { error: string }
> {
  let result: PauseAllResult;
  try {
    result = await apiPost<PauseAllResult>(
      "/survey/schedules/pause-all",
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to pause the active surveys.",
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * Pause one graduation year's campaign. Full-access on the backend (same gate
 * as the per-year cancel), not engineer-only — this console is just where an
 * engineer reaches it. The refreshed campaign comes back so the caller can
 * report the real state rather than assuming the press landed.
 */
export async function pauseSurvey(
  graduationYear: number,
): Promise<{ result: SurveyScheduleItem } | { error: string }> {
  let result: SurveyScheduleItem;
  try {
    result = await apiPost<SurveyScheduleItem>(
      `/survey/schedules/${graduationYear}/pause`,
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : `Failed to pause the ${graduationYear} campaign.`,
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * Resume one paused campaign. The backend shifts its start date forward by
 * however long it was paused, so it picks up at the stage that was due when it
 * stopped rather than ageing past its reminder windows — which is why the
 * refreshed campaign (carrying the new start date) is handed back.
 */
export async function resumeSurvey(
  graduationYear: number,
): Promise<{ result: SurveyScheduleItem } | { error: string }> {
  let result: SurveyScheduleItem;
  try {
    result = await apiPost<SurveyScheduleItem>(
      `/survey/schedules/${graduationYear}/resume`,
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : `Failed to resume the ${graduationYear} campaign.`,
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * One alumnus's survey campaign state — what was emailed, what came back, and
 * what is holding them out of the next send. Straight off the generated OpenAPI.
 */
export type SurveyAlumniState = components["schemas"]["SurveyAlumniState"];

/**
 * What a reset actually did — counts of what stopped counting and, just as
 * importantly, what is still there. It deletes nothing (#395).
 */
export type SurveyResetResult = components["schemas"]["SurveyResetResult"];

/** What deleting a campaign removed, and what it kept (#398). */
export type SurveyScheduleDeleteResult =
  components["schemas"]["SurveyScheduleDeleteResult"];

/**
 * Read an alumnus's survey state BEFORE offering the reset (#395).
 *
 * A reset destroys nothing, but it is still usually unnecessary: a person looks
 * blocked because they legitimately replied a few months ago, and re-asking them
 * is then a judgement call rather than a repair. So the UI must show this first
 * and never reset from search results alone.
 *
 * Engineer-only; the backend re-enforces RequireEngineer.
 */
export async function getSurveyAlumnusState(
  alumniId: number,
): Promise<{ state: SurveyAlumniState } | { error: string }> {
  try {
    return {
      state: await apiGet<SurveyAlumniState>(`/survey/alumni/${alumniId}/state`),
    };
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to load this alum’s survey state.",
    };
  }
}

/**
 * Make ONE alumnus surveyable again — the UI replacement for hand-running
 * DELETE statements (#395), which itself now deletes nothing.
 *
 * Their submitted answers, the record of the emails sent to them and any staged
 * survey photo all stay in the database and on their profile; a reply awaiting
 * review stays in the review queue and can still be applied. The only effect is
 * that eligibility queries stop counting what predates the reset. Callers must
 * still have shown `getSurveyAlumnusState`: a reset that unblocks nothing is
 * noise, and re-surveying someone means a real email.
 *
 * Engineer-only; the backend re-enforces RequireEngineer on
 * POST /survey/alumni/{id}/reset. The real counts come back — superseded AND
 * preserved — so the UI reports what happened instead of assuming success.
 */
export async function resetSurveyCampaign(
  alumniId: number,
): Promise<{ result: SurveyResetResult } | { error: string }> {
  let result: SurveyResetResult;
  try {
    result = await apiPost<SurveyResetResult>(
      `/survey/alumni/${alumniId}/reset`,
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to reset this alum’s survey campaign.",
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * Remove one graduation year's campaign — the schedule row, and nothing else
 * (#398). The emails already sent and the answers alumni submitted are kept.
 *
 * Works on ANY campaign now, whatever its status. It used to 409 for any year
 * that had ever sent an email, because deleting the row took the year's cycle
 * number with it and the next campaign would then skip everybody; the backend
 * retires that cycle instead, so a new campaign for the year starts above the
 * old sends and reaches those alumni again. Engineer-only; the backend
 * re-enforces RequireEngineer on DELETE /survey/schedules/{year}.
 */
export async function deleteSurveyCampaign(
  graduationYear: number,
): Promise<{ result: SurveyScheduleDeleteResult } | { error: string }> {
  let result: SurveyScheduleDeleteResult;
  try {
    result = await apiDelete<SurveyScheduleDeleteResult>(
      `/survey/schedules/${graduationYear}`,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : `Failed to delete the ${graduationYear} campaign.`,
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}

/**
 * Stop one graduation year's campaign for good (#398). The row stays, listed
 * with its counts, and never resumes.
 *
 * Its own action, not a fallback for a delete that would be refused: "stop this
 * cohort's emails but keep the campaign on the console" is a different intent
 * from "get this campaign off my screen", and both are offered.
 */
export async function cancelSurveyCampaign(
  graduationYear: number,
): Promise<{ result: SurveyScheduleItem } | { error: string }> {
  let result: SurveyScheduleItem;
  try {
    result = await apiPost<SurveyScheduleItem>(
      `/survey/schedules/${graduationYear}/cancel`,
      undefined,
    );
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : `Failed to cancel the ${graduationYear} campaign.`,
    };
  }
  revalidatePath("/engineer/surveys");
  return { result };
}
