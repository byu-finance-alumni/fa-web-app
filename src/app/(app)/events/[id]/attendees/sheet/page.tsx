import { redirect } from "next/navigation";

/**
 * The sign-up spreadsheet import now lives on the combined "Import attendees"
 * screen (2026-11-19), which picks the review flow from the file's columns.
 * This path is kept so an old link or bookmark still lands in the right place.
 */
export default async function ImportAttendeeSheetRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/events/${encodeURIComponent(id)}/attendees/import`);
}
