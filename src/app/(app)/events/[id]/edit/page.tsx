import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventForm } from "@/components/events/EventForm";
import { AttendeeManager } from "@/components/events/AttendeeManager";
import { DeleteEventButton } from "@/components/events/DeleteEventButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, ApiError } from "@/lib/api";
import { canManageEvents as canManageEventsCap } from "@/constants/capabilities";
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
    canManageEvents = canManageEventsCap(ctx.capabilities);
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
      <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
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
          {/* Two columns, each running the full height of the page.
              LEFT: the event's own details, with Danger zone tucked underneath
              it — delete is a detail-of-this-event action, so it belongs in that
              column at half width rather than spanning the page. RIGHT: the
              attendee manager, stretched to the bottom, because the roster is
              the long-lived list you actually work in and it earns the space.
              Stacks on smaller screens, where heights go natural. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="flex h-full min-h-0 flex-col gap-6">
              <EventForm
                action={action}
                submitLabel="Save changes"
                cancelHref="/events"
                eventTypeOptions={eventTypeOptions}
                cardClassName="w-full"
                initialValues={{
                  event_name: event.event_name,
                  event_type: event.event_type,
                  event_date: event.event_date,
                  event_location: event.event_location,
                  event_notes: event.event_notes,
                }}
              />

              <Card className="w-full">
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

            <AttendeeManager
              eventId={event.event_id}
              className="flex h-full min-h-0 w-full flex-col lg:min-h-[calc(100vh-11rem)]"
            />
          </div>
        </div>
      </main>
    </>
  );
}
