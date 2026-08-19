import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AttendeeMatchWizard } from "@/components/events/import/AttendeeMatchWizard";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { canManageEvents as canManageEventsCap } from "@/constants/capabilities";

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
 * controls the backend would 403 on — but ONLY when the backend actually said
 * so. An unreadable context renders the error here instead (#688): this screen
 * writes attendance rows against alumni records, so "we could not check" must
 * never resolve to "let them in", and it must not resolve to a bounce either,
 * which hides the outage behind a URL change. redirect() runs outside every
 * branch that could swallow its control-flow signal.
 */
export default async function ImportEventAttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let canManageEvents = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canManageEvents = canManageEventsCap(ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Match attendees" },
        ]}
      />
    );
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
