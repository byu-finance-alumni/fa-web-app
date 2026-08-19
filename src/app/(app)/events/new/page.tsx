import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { EventWizard } from "@/components/events/EventWizard";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canCreateEvents, canImportEvents } from "@/constants/capabilities";
import { hasFullAccess } from "@/constants/roles";
import { getEventTypeOptions } from "../vocab";
import { createEvent, previewEvent } from "../actions";

/**
 * Add event — the plain create form, and the destination of every "Add event"
 * button (#611).
 *
 * No attendee list is required to get here or to finish: the wizard creates the
 * event on its own and the roster is attached afterwards. Bulk CSV import lives
 * at /events/import as its own clearly-labelled action.
 */
export default async function NewEventPage() {
  // Creating an event is gated on the editable `events.create` CAPABILITY
  // (fa-web-api #378), which the backend enforces on POST /events. Read the
  // capability, not the role: it is seeded to full_access and up, but an
  // engineer can grant it to a narrower role from the permission editor, and a
  // role check here would bounce someone the backend would accept. Anyone
  // without it is sent to the read-only events list rather than shown a form
  // that 403s on submit. redirect() runs outside every branch that could
  // swallow it (it throws a control-flow signal). Backend is the source of
  // truth; this is UX only.
  //
  // A 401/403 is that answer and still redirects. An unreadable context is NOT
  // an answer (#688): we would be bouncing someone who may well hold
  // events.create, off the URL they asked for, on a fault that has nothing to
  // do with them. All three flags stay false and the error renders in place.
  let canCreate = false;
  // Separate, coarser gate: the attendee-match upload is guarded by
  // require_full_access on the backend, so "take me to the upload next" is only
  // offered to someone that screen will actually let in. It never gates creating
  // the event itself — an event with no attendees is the common case.
  let canUploadAttendees = false;
  let canImport = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canCreate = canCreateEvents(ctx.capabilities);
    canImport = canImportEvents(ctx.capabilities);
    canUploadAttendees = hasFullAccess(ctx.roles);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Add event" },
        ]}
      />
    );
  }
  if (!canCreate) redirect("/events");

  const eventTypeOptions = await getEventTypeOptions();
  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Add event" },
        ]}
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <EventWizard
          action={createEvent}
          previewAction={previewEvent}
          eventTypeOptions={eventTypeOptions}
          cancelHref="/events"
          canUploadAttendees={canUploadAttendees}
          importHref={canImport ? "/events/import" : null}
        />
      </main>
    </>
  );
}
