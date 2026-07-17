import Link from "next/link";
import { Topbar } from "@/components/shell/Topbar";
import { Card, CardContent } from "@/components/ui/card";
import { loadEditableProfile } from "./load-profile";

/** The six focused edit sections shown as a picker. */
const SECTIONS: { slug: string; title: string; description: string }[] = [
  {
    slug: "employment",
    title: "Update Employment Information",
    description: "Employer, title, industry, work location, LinkedIn.",
  },
  {
    slug: "personal",
    title: "Update Personal Information",
    description: "Personal email, phone, NetID, spouse, citizenship.",
  },
  {
    slug: "graduate",
    title: "Add Graduate Program",
    description: "Graduate degree, university, and graduation year.",
  },
  {
    slug: "designation",
    title: "Add Designation / Certificate",
    description: "CFA, CFP, and other professional designations.",
  },
  {
    slug: "engagement",
    title: "Add Engagement",
    description: "Willingness flags and engagement notes.",
  },
  {
    slug: "narrative",
    title: "Add Narrative",
    description: "Startup, advisory, and secondary-employment context.",
  },
];

export default async function EditAlumniPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadEditableProfile(id);
  const a = p.alumni;
  const name =
    [a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              What would you like to edit?
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Pick a section to jump straight to those fields. Saving updates
              only that section and returns you to the profile.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <Link
                key={s.slug}
                href={`/alumni/${a.alumni_id}/edit/${s.slug}`}
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <Card className="h-full transition-colors hover:border-brand-blue-600 hover:bg-gray-50">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {s.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
