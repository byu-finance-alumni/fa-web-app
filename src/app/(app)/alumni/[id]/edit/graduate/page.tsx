import { Topbar } from "@/components/shell/Topbar";
import { GraduateSectionForm } from "@/components/alumni/edit-sections/GraduateSectionForm";
import { loadEditableProfile, s } from "../load-profile";
import { AccessCheckError } from "@/components/shared/AccessCheckError";

/** Degrees offered as fixed buckets; anything else maps to "Other" + specify. */
const KNOWN_DEGREES = ["MBA", "Law", "Medical"] as const;

export default async function GraduateEditPage({
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
          { label: "Graduate" },
        ]}
      />
    );
  }
  const p = gate.profile;
  const a = p.alumni;
  const name =
    [a.preferred_first_name ?? a.first_name, a.last_name].filter(Boolean).join(" ") || "Alumnus";

  // Map the stored free-text graduate_degree onto the dropdown: a case-
  // insensitive match to MBA/Law/Medical selects that bucket; any other non-
  // empty value selects "Other" and prefills the specify box.
  const gd = (a.graduate_degree ?? "").trim();
  const match = KNOWN_DEGREES.find((k) => k.toLowerCase() === gd.toLowerCase());
  const degreeChoice = match ?? (gd ? "Other" : "");
  const degreeOther = match ? "" : gd;

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "Alumni", href: "/alumni" },
          { label: name, href: `/alumni/${a.alumni_id}` },
          { label: "Edit", href: `/alumni/${a.alumni_id}/edit` },
          { label: "Graduate program" },
        ]}
      />
      <main className="flex-1 overflow-auto p-6">
        <GraduateSectionForm
          id={a.alumni_id}
          defaults={{
            employment_status: s(a.employment_status),
            degree_choice: degreeChoice,
            degree_other: degreeOther,
            graduate_school: s(a.graduate_school),
            graduate_graduation_year: s(a.graduate_graduation_year),
          }}
        />
      </main>
    </>
  );
}
