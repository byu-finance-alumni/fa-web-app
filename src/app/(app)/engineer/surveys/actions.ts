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
