import { apiGet } from "@/lib/api";

/**
 * Active event-type options from the editable vocabulary (#82). Admins curate
 * these under Admin → Vocabulary. Cached briefly and tagged "vocabulary" so a
 * vocab edit can revalidate it. Returns [] on error so the form still renders.
 */
export async function getEventTypeOptions(): Promise<string[]> {
  try {
    const res = await apiGet<{ category: string; values: string[] }>(
      "/vocabulary/event_type",
      { revalidate: 300, tags: ["vocabulary"] },
    );
    return res.values ?? [];
  } catch {
    return [];
  }
}
