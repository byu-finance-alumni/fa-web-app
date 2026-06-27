"use server";

import { revalidatePath } from "next/cache";
import {
  apiPost,
  apiPatch,
  apiDelete,
  apiPostForm,
  apiGetText,
  ApiError,
} from "@/lib/api";
import type {
  DonationImportPreview,
  DonationImportResult,
} from "@/types/donations";

export type DonationActionResult = { ok: true } | { ok: false; error: string };

/**
 * Add a donation to an alumnus (super_admin). Amount is a string from the form
 * input; the backend validates/quantizes it. Year is required; month optional.
 */
export async function addDonation(
  alumniId: number,
  input: { amount: string; year: number; month?: number; notes?: string },
): Promise<DonationActionResult> {
  try {
    await apiPost(`/donations/alumni/${alumniId}`, {
      amount: input.amount,
      year: input.year,
      ...(input.month ? { month: input.month } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to add donation.",
    };
  }
  revalidatePath("/pay-it-forward");
  return { ok: true };
}

/** Edit a donation (super_admin). */
export async function updateDonation(
  donationId: number,
  patch: { amount?: string; year?: number; month?: number | null; notes?: string | null },
): Promise<DonationActionResult> {
  try {
    await apiPatch(`/donations/${donationId}`, patch);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to save donation.",
    };
  }
  revalidatePath("/pay-it-forward");
  return { ok: true };
}

/** Delete a donation (super_admin). */
export async function deleteDonation(
  donationId: number,
): Promise<DonationActionResult> {
  try {
    await apiDelete(`/donations/${donationId}`);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Failed to delete donation.",
    };
  }
  revalidatePath("/pay-it-forward");
  return { ok: true };
}

/* ------------------------------------------------------- CSV bulk import ----- */

export type DonationImportPreviewState =
  | { ok: true; data: DonationImportPreview }
  | { ok: false; error: string };

export type DonationImportResultState =
  | { ok: true; data: DonationImportResult }
  | { ok: false; error: string };

function importFormData(formData: FormData): FormData | null {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  const fd = new FormData();
  fd.append("file", file, file.name);
  return fd;
}

/** Dry-run a donations CSV against POST /donations/import/preview (super_admin). */
export async function previewDonationsImport(
  formData: FormData,
): Promise<DonationImportPreviewState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to check." };
  try {
    const data = await apiPostForm<DonationImportPreview>(
      "/donations/import/preview",
      fd,
    );
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't read the file — try again.",
    };
  }
}

/** Commit the donations import via POST /donations/import (super_admin). */
export async function commitDonationsImport(
  formData: FormData,
): Promise<DonationImportResultState> {
  const fd = importFormData(formData);
  if (!fd) return { ok: false, error: "Choose a .csv file to import." };
  try {
    const data = await apiPostForm<DonationImportResult>("/donations/import", fd);
    revalidatePath("/pay-it-forward");
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Import failed — try again.",
    };
  }
}

/** Fetch the donations import CSV template (GET /donations/import/template). */
export async function downloadDonationsTemplate(): Promise<
  { ok: true; csv: string } | { ok: false; error: string }
> {
  try {
    const csv = await apiGetText("/donations/import/template");
    return { ok: true, csv };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Couldn't download the template.",
    };
  }
}
