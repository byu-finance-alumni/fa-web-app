import { Topbar } from "@/components/shell/Topbar";
import { NarrativeSectionForm } from "@/components/alumni/edit-sections/NarrativeSectionForm";
import { loadEditableProfile, s } from "../load-profile";
import { AccessCheckError } from "@/components/shared/AccessCheckError";

export default async function NarrativeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gate = await loadEditableProfile(id);
  // An unreadable /auth/context is not a denial (#688). Staying on this URL and
  // naming the fault beats both alternatives: bouncing to the read-only profile
  // reads as "my edit access was revoked", and rendering the form anyway would
  // open an editor over alumni records we never confirmed this account may
  // touch. A real 401/403 never reaches here — the guard redirects on that.
  if (gate.status !== "ok") {
    return (
      <AccessCheckError
        status={gate.httpStatus}
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: "Edit", href: `/alumni/${id}/edit` },
          { label: "Narrative" },
        ]}
      />
    );
  }
  const p = gate.profile;
  const a = p.alumni;
  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Narrative" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <NarrativeSectionForm
          id={a.alumni_id}
          defaults={{
            startup_involvement: s(a.startup_involvement),
            advisory_roles: s(a.advisory_roles),
            secondary_employment: s(a.secondary_employment),
          }}
        />
      </main>
    </>
  );
}
