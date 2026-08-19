import { Topbar } from "@/components/shell/Topbar";
import { EngagementSectionForm } from "@/components/alumni/edit-sections/EngagementSectionForm";
import { loadEditableProfile, s } from "../load-profile";
import { AccessCheckError } from "@/components/shared/AccessCheckError";

export default async function EngagementEditPage({
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
          { label: "Engagement" },
        ]}
      />
    );
  }
  const p = gate.profile;
  const a = p.alumni;
  const eng = p.program_engagement;
  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Engagement" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <EngagementSectionForm
          id={a.alumni_id}
          defaults={{
            flags: {
              nettrek_host_willing: !!eng?.nettrek_host_willing,
              mentor_willing: !!eng?.mentor_willing,
              guest_speaker_willing: !!eng?.guest_speaker_willing,
              case_competition_host_willing: !!eng?.case_competition_host_willing,
              finance_conference_willing: !!eng?.finance_conference_willing,
              company_event_sponsor_willing: !!eng?.company_event_sponsor_willing,
              women_in_finance_mentor_willing:
                !!eng?.women_in_finance_mentor_willing,
              piff_donor: !!eng?.piff_donor,
              hired_finance_intern: !!eng?.hired_finance_intern,
              hired_finance_full_time: !!eng?.hired_finance_full_time,
              help_at_event_willing: !!eng?.help_at_event_willing,
            },
            engagement_notes: s(eng?.engagement_notes),
          }}
        />
      </main>
    </>
  );
}
