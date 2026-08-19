import { redirect } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import { AlumniForm } from "@/components/alumni/AlumniForm";
import { AccessCheckError } from "@/components/shared/AccessCheckError";
import { readAuthContext } from "@/lib/auth-context";
import { canCreateAlumni } from "@/constants/capabilities";
import { createAlumni, createFriend, previewAlumni } from "../actions";

export default async function NewAlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  // #218: /alumni/new?kind=friend creates a non-alumni "friend" record via
  // createFriend (is_alumni=false), so the Friends roster stays separate from
  // Alumni. Everything else (form, preview) is identical. Resolved before the
  // gate purely so the error screen below can breadcrumb back to the right list.
  const isFriend = (await searchParams).kind === "friend";

  // Create is gated on the `alumni.create` capability (fa-web-api #379), seeded
  // to engineer / super_admin / full_access — NOT students, who may only edit
  // existing records. Read from the capability list rather than the role so an
  // engineer's grant takes effect here too. The backend enforces the same guard
  // (POST /alumni -> RequireAlumniCreate); this just keeps roles without it out
  // of the create UI.
  //
  // The two failure modes are NOT the same (#688). A 401/403 is the backend's
  // answer and the redirect below is right. Anything else means we could not
  // ask — bouncing then moves the user off the URL they asked for and blames a
  // working button for an outage, while rendering the form anyway would open a
  // create screen we never checked they may use. Say so instead, in place.
  let canCreate = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const ctx = auth.ctx;
    canCreate = canCreateAlumni(ctx.capabilities);
  }
  if (auth.status === "unavailable") {
    return (
      <AccessCheckError
        status={auth.httpStatus}
        breadcrumb={[
          isFriend
            ? { label: "Friends", href: "/friends" }
            : { label: "Alumni", href: "/alumni" },
          { label: isFriend ? "Add friend" : "Add alumni" },
        ]}
      />
    );
  }
  // `redirect()` runs outside every branch that could swallow it — it works by
  // throwing a control-flow signal.
  if (!canCreate) redirect("/alumni");

  return (
    <>
      <Topbar
        breadcrumb={[
          isFriend
            ? { label: "Friends", href: "/friends" }
            : { label: "Alumni", href: "/alumni" },
          { label: isFriend ? "Add friend" : "Add alumni" },
        ]}
      />
      {/* Identical chrome to /events/new (#611) — the two "Add" screens are
          meant to be indistinguishable. `p-4` on a phone, the standard `p-6`
          from `md` up. */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <AlumniForm
          action={isFriend ? createFriend : createAlumni}
          previewAction={previewAlumni}
          submitLabel={isFriend ? "Create friend" : "Create alumni"}
          cancelHref={isFriend ? "/friends" : "/alumni"}
          extended
        />
      </main>
    </>
  );
}
