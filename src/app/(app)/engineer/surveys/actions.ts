"use server";

import { revalidatePath } from "next/cache";
import { apiGet, apiPost, ApiError } from "@/lib/api";
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

/** What a reset actually deleted — counts, so the toast can report the truth. */
export type SurveyResetResult = components["schemas"]["SurveyResetResult"];

/**
 * Read an alumnus's survey state BEFORE offering the reset (#395).
 *
 * The whole point of this call is that a reset is usually the WRONG move: a
 * person looks blocked because they legitimately replied a few months ago, and
 * deleting that reply to re-ask them destroys a real answer. So the UI must show
 * this first and never reset from search results alone.
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
 * Clear ONE alumnus's survey campaign state so they can be surveyed again — the
 * UI replacement for hand-running DELETE statements (#395).
 *
 * DESTRUCTIVE AND IRREVERSIBLE: it permanently deletes that person's submitted
 * survey answers, including any still awaiting review, along with the record of
 * the emails they were sent. Callers must have shown `getSurveyAlumnusState` and
 * a confirmation naming the person and what is lost.
 *
 * Engineer-only; the backend re-enforces RequireEngineer on
 * POST /survey/alumni/{id}/reset. The real deletion counts come back so the UI
 * reports what happened instead of assuming success.
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
