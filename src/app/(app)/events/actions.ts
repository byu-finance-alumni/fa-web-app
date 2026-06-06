"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";

export type FormState = { error?: string } | null;

function buildPayload(formData: FormData): Record<string, unknown> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const payload: Record<string, unknown> = {
    event_name: str("event_name"),
    event_type: str("event_type"),
    event_date: str("event_date"),
    event_location: str("event_location"),
    event_notes: str("event_notes"),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  return payload;
}

export async function createEvent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get("event_name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Event name is required." };
  }
  try {
    await apiPost<{ event_id: number }>("/events", buildPayload(formData));
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to create event." };
  }
  revalidatePath("/events");
  redirect("/events");
}
