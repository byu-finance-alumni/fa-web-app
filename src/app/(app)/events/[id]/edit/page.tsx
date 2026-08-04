import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { AttendeeManager } from "@/components/events/AttendeeManager";
import { DeleteEventButton } from "@/components/events/DeleteEventButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="w-full space-y-6">
          {/* Landing hint after a create (#611). The event exists with nobody on
              it — which is fine and expected — so the banner names BOTH ways to
              fill the roster and makes clear neither is due now. */}
          {created ? (
            <p className="rounded-lg border border-brand-blue-300 bg-brand-blue-50 px-4 py-3 text-sm text-navy-800">
              Event created with no attendees. Add them below whenever you like —
              one at a time, or by uploading a list. Nothing else is needed to
              keep this event.
            </p>
          ) : null}
          {/* Full-width two-column layout: event details on the left, the
              attendee manager on the right, as equal-height boxes (items-stretch
              + h-full). The attendee list scrolls inside its box. Danger zone
              spans full width below. Stacks on smaller screens. */}
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <EventForm
              action={action}
              submitLabel="Save changes"
              cancelHref="/events"
              eventTypeOptions={eventTypeOptions}
              cardClassName="h-full w-full"
              initialValues={{
                event_name: event.event_name,
                event_type: event.event_type,
                event_date: event.event_date,
                event_location: event.event_location,
                event_notes: event.event_notes,
              }}
            />
            <AttendeeManager eventId={event.event_id} className="h-full w-full" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-danger-600">Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Deleting this event also removes its attendance records.
              </p>
              <div className="mt-3">
                <DeleteEventButton
                  eventId={event.event_id}
                  eventName={event.event_name}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
