import { Topbar } from "@/components/shell/Topbar";
import { DesignationSectionForm } from "@/components/alumni/edit-sections/DesignationSectionForm";
import { loadEditableProfile, s } from "../load-profile";

export default async function DesignationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadEditableProfile(id);
  const a = p.alumni;
  const eng = p.program_engagement;
  const name =
    [a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Designation" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <DesignationSectionForm
          id={a.alumni_id}
          defaults={{
            cfa: !!(eng?.cfa_designation && eng.cfa_designation.trim()),
            cfp: !!(eng?.cfp_designation && eng.cfp_designation.trim()),
            other_designations: s(a.other_designations),
          }}
        />
      </main>
    </>
  );
}
