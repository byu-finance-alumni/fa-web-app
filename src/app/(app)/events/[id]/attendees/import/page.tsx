import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AttendeeMatchWizard } from "@/components/events/import/AttendeeMatchWizard";
import { apiGet, ApiError } from "@/lib/api";
import { hasFullAccess } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";

interface EventDetail {
  event_id: number;
  event_name: string;
}

/**
 * Upload a conference attendee list for ONE existing event and match it to
 * alumni (#612).
 *
 * Scoped to an event on purpose (Jake, 2026-08-04): approving a match means
 * "this person attended THIS event", so there is always an obvious "attending
 * what?" answer. This is deliberately not a general-purpose people-finder.
 *
 * full_access, mirroring the backend guard on every leg of the flow. view_only
 * users who land here directly go back to the events list rather than see
 * controls the backend would 403 on. The redirect happens OUTSIDE the catch —
 * redirect() throws a control-flow signal a catch would swallow (same pattern
 * as /events/[id]/edit).
 */
export default async function ImportEventAttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let canManageEvents = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManageEvents = hasFullAccess(ctx.roles);
  } catch {
    /* not provisioned / context error -> treat as no manage access */
  }
  if (!canManageEvents) redirect("/events");

  let event: EventDetail;
  try {
    event = await apiGet<EventDetail>(`/events/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: event.event_name || "Event", href: `/events/${event.event_id}/edit` },
          { label: "Match attendees" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <AttendeeMatchWizard
          eventId={event.event_id}
          eventName={event.event_name}
        />
      </main>
    </>
  );
}
