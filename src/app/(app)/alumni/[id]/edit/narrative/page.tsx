import { Topbar } from "@/components/shell/Topbar";
import { NarrativeSectionForm } from "@/components/alumni/edit-sections/NarrativeSectionForm";
import { loadEditableProfile, s } from "../load-profile";

export default async function NarrativeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadEditableProfile(id);
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
