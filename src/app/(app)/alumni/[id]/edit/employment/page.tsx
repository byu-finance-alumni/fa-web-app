import { Topbar } from "@/components/shell/Topbar";
import { EmploymentSectionForm } from "@/components/alumni/edit-sections/EmploymentSectionForm";
import { loadEditableProfile, s } from "../load-profile";

export default async function EmploymentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadEditableProfile(id);
  const a = p.alumni;
  const c = p.contact;
  const career = p.current_career;
  const name =
    [a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Employment" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <EmploymentSectionForm
          id={a.alumni_id}
          defaults={{
            employment_status: s(a.employment_status),
            current_employer: s(career?.current_employer),
            current_title: s(career?.current_title),
            current_industry: s(career?.current_industry),
            current_industry_secondary: s(career?.current_industry_secondary),
            current_city: s(career?.current_city),
            current_state: s(career?.current_state),
            current_country: s(career?.current_country),
            work_email: s(c?.work_email),
            linkedin_url: s(a.linkedin_url),
            region: s(c?.region),
          }}
        />
      </main>
    </>
  );
}
