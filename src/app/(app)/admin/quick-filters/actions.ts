"use server";

import { revalidatePath } from "next/cache";
import { apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type Result = { error?: string } | null;

/**
 * Dashboard quick-filter preset admin actions (engineer + super_admin — the
 * backend re-enforces via RequireSuperAdmin). These edit the compound-search
 * presets shown on the dashboard Quick search tab. Each mutation revalidates
 * the editor page and the dashboard so the change shows immediately.
 */

function revalidate() {
  revalidatePath("/admin/quick-filters");
  revalidatePath("/dashboard");
}

export async function createPreset(input: {
  label: string;
  href: string;
  sort_order?: number;
}): Promise<Result> {
  try {
    await apiPost("/admin/dashboard-presets", {
      label: input.label,
      href: input.href,
      ...(input.sort_order != null ? { sort_order: input.sort_order } : {}),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add preset." };
  }
  revalidate();
  return null;
}

export async function updatePreset(
  presetId: number,
  input: { label?: string; href?: string; sort_order?: number },
): Promise<Result> {
  try {
    await apiPatch(`/admin/dashboard-presets/${presetId}`, input);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update preset.",
    };
  }
  revalidate();
  return null;
}

export async function deletePreset(presetId: number): Promise<Result> {
  try {
    await apiDelete(`/admin/dashboard-presets/${presetId}`);
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove preset.",
    };
  }
  revalidate();
  return null;
}
