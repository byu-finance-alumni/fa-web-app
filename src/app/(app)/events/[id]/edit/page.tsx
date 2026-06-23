import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { AttendeeManager } from "@/components/events/AttendeeManager";
import { apiGet, ApiError } from "@/lib/api";
import { hasFullAccess } from "@/constants/roles";
import type { UserContext } from "@/types/alumni";
import { getEventTypeOptions } from "../../vocab";
import { updateEvent } from "../../actions";

interface EventDetail {
  event_id: number;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  event_notes: string | null;
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  // Event management (edit + attendance) requires full_access — mirrors backend
  // require_full_access on PUT /events/{id} and the attendee endpoints. view_only
  // ("Professor") users who land here directly are sent back to the read-only
  // events list rather than shown a form/attendee controls the backend would
  // 403 on submit. Resolve the flag inside try/catch, then redirect OUTSIDE it —
  // redirect() throws a control-flow signal a catch would otherwise swallow
  // (same pattern as /alumni/{id}/edit). Backend stays the source of truth.
  let canManageEvents = false;
  try {
    const ctx = await apiGet<UserContext>("/auth/context");
    canManageEvents = hasFullAccess(ctx.roles);
  } catch {
    /* not provisioned / context error → treat as no manage access */
  }
  if (!canManageEvents) redirect("/events");

  let event: EventDetail;
  try {
    event = await apiGet<EventDetail>(`/events/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const action = updateEvent.bind(null, event.event_id);
  const eventTypeOptions = await getEventTypeOptions();

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: event.event_name || "Event" },
          { label: "Edit" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        {created ? (
          <p className="mb-4 rounded-lg border border-brand-blue-300 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
            Event created. Add attendees below.
          </p>
        ) : null}
        <EventForm
          action={action}
          submitLabel="Save changes"
          cancelHref="/events"
          eventTypeOptions={eventTypeOptions}
          initialValues={{
            event_name: event.event_name,
            event_type: event.event_type,
            event_date: event.event_date,
            event_location: event.event_location,
            event_notes: event.event_notes,
          }}
        />
        <AttendeeManager eventId={event.event_id} />
      </main>
    </>
  );
}
