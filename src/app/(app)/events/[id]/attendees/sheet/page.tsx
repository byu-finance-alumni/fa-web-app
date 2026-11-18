import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AttendeeSheetWizard } from "@/components/events/import/AttendeeSheetWizard";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { apiGet, ApiError } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { canManageEvents as canManageEventsCap } from "@/constants/capabilities";

interface EventDetail {
  event_id: number;
  event_name: string;
}

/**
 * Import an event's sign-up spreadsheet (api#693): match on name + grad year,
 * create new alumni / friends, all behind a confirm screen.
 *
 * Same guard posture as the conference matcher page next door: events.manage
 * (the backend additionally requires alumni.create to save new people). An
 * unreadable auth context renders the error here rather than bouncing (#688).
 */
export default async function ImportAttendeeSheetPage({
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
          { label: "Import spreadsheet" },
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
          { label: "Import spreadsheet" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <AttendeeSheetWizard
          eventId={event.event_id}
          eventName={event.event_name}
        />
      </main>
    </>
  );
}
