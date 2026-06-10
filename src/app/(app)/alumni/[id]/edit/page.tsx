import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/Topbar";
import {
  AlumniForm,
  type AlumniFormDefaults,
} from "@/components/alumni/AlumniForm";
import { apiGet, ApiError } from "@/lib/api";
import type { Profile } from "@/types/profile";
import { updateAlumni } from "../../actions";

/** Stringify a nullable scalar for a text/number input default ("" when null). */
function s(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

export default async function EditAlumniPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let p: Profile;
  try {
    p = await apiGet<Profile>(`/alumni/${id}/profile`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const a = p.alumni;
  const c = p.contact;
  const career = p.current_career;
  // The profile aggregate returns education as a list; the wizard edits a single
  // (most recent) education row, matching what create writes and the service
  // upserts.
  const edu = p.education[0] ?? null;
  const eng = p.program_engagement;

  const defaults: AlumniFormDefaults = {
    ...a,
    spouseAlumniName: p.spouse_alumni_name,
    contact: c
      ? {
          personal_email: s(c.personal_email),
          work_email: s(c.work_email),
          phone: s(c.phone),
          address_line_1: s(c.address_line_1),
          address_line_2: s(c.address_line_2),
          city: s(c.city),
          state: s(c.state),
          zip: s(c.zip),
          country: s(c.country),
          region: s(c.region),
        }
      : undefined,
    career: career
      ? {
          current_employer: s(career.current_employer),
          current_title: s(career.current_title),
          current_industry: s(career.current_industry),
          current_industry_secondary: s(career.current_industry_secondary),
          current_city: s(career.current_city),
          current_state: s(career.current_state),
          current_country: s(career.current_country),
          current_zip: s(career.current_zip),
          seniority_level: s(career.seniority_level),
        }
      : undefined,
    education: edu
      ? {
          university: s(edu.university),
          college: s(edu.college),
          department: s(edu.department),
          degree: s(edu.degree),
          major: s(edu.major),
          degree_status: s(edu.degree_status),
          degree_year: s(edu.degree_year),
        }
      : undefined,
    engagement: eng
      ? {
          flags: {
            nettrek_host_willing: eng.nettrek_host_willing,
            finance_conference_willing: eng.finance_conference_willing,
            mentor_willing: eng.mentor_willing,
            company_event_sponsor_willing: eng.company_event_sponsor_willing,
            guest_speaker_willing: eng.guest_speaker_willing,
            help_at_event_willing: eng.help_at_event_willing,
            case_competition_host_willing: eng.case_competition_host_willing,
            women_in_finance_mentor_willing:
              eng.women_in_finance_mentor_willing,
            hired_finance_intern: eng.hired_finance_intern,
            hired_finance_full_time: eng.hired_finance_full_time,
            piff_donor: eng.piff_donor,
            cfp_designation: eng.cfp_designation,
            cfa_designation: eng.cfa_designation,
          },
          engagement_notes: s(eng.engagement_notes),
        }
      : undefined,
  };

  const action = updateAlumni.bind(null, a.alumni_id);
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
        <AlumniForm
          extended
          action={action}
          defaults={defaults}
          submitLabel="Save changes"
          cancelHref={`/alumni/${a.alumni_id}`}
        />
      </main>
    </>
  );
}
