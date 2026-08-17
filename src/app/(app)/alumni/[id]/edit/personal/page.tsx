import { Topbar } from "@/components/shell/Topbar";
import { PersonalSectionForm } from "@/components/alumni/edit-sections/PersonalSectionForm";
import { loadEditableProfile, s } from "../load-profile";

export default async function PersonalEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadEditableProfile(id);
  const a = p.alumni;
  const c = p.contact;
  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";
  const spouseName = [a.spouse_first_name, a.spouse_last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Personal" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <PersonalSectionForm
          id={a.alumni_id}
          defaults={{
            first_name: s(a.first_name),
            middle_name: s(a.middle_name),
            last_name: s(a.last_name),
            preferred_first_name: s(a.preferred_first_name),
            birth_name: s(a.birth_name),
            personal_email: s(c?.personal_email),
            work_email: s(c?.work_email),
            phone: s(c?.phone),
            preferred_contact_method: s(c?.preferred_contact_method),
            // Residence (#440) — the same three contact columns the survey
            // collects and the profile shows as "Resident city".
            city: s(c?.city),
            state: s(c?.state),
            country: s(c?.country),
            net_id: s(a.net_id),
            spouse_name: spouseName,
            citizenship: s(a.citizenship),
            home_country: s(a.home_country),
          }}
        />
      </main>
    </>
  );
}
