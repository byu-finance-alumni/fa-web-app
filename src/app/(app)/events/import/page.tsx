import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canImportEvents } from "@/constants/capabilities";
import { EventsImportWizard } from "@/components/events/import/EventsImportWizard";

/**
 * Events CSV bulk-import screen (#156). Gated on the editable `events.import`
 * CAPABILITY (fa-web-api #378), which the backend enforces on all three legs of
 * the flow — template, preview, and commit. Read the capability, not the role:
 * `events.import` is seeded to full_access and up but an engineer can grant it
 * to any role, and a role check would bounce someone the backend would let in.
 * Anyone without it is redirected back to the events list rather than shown a
 * dead-end page.
 *
 * That redirect is for a REAL denial only (#688). A 5xx / timeout / unreachable
 * `/auth/context` is not the backend saying no, it is the backend saying
 * nothing, and this page bulk-writes event records: the flag stays false, the
 * wizard does not render, and the fault is stated here rather than hidden
 * behind a bounce to a list that is failing too.
 */
export default async function ImportEventsPage() {
  let canImport = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canImport = canImportEvents(ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Import CSV" },
        ]}
      />
    );
  }
  if (!canImport) redirect("/events");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Events", href: "/events" },
          { label: "Import CSV" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <EventsImportWizard />
      </main>
    </>
  );
}
