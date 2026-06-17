import {
  ShieldCheck,
  Database,
  Users,
  History,
  Lock,
  Trash2,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";

export const metadata = {
  title: "Privacy & data handling",
};

/* ----------------------------------------------------------------- helpers */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- page -- */

export default function PrivacyPage() {
  return (
    <>
      <Topbar title="Privacy & data handling">
        <TopbarSearch />
      </Topbar>

      <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Intro */}
          <div className="rounded-xl border border-gray-300 bg-white p-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              How we handle alumni data
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              The BYU Finance Alumni Database is an internal tool of the BYU
              Marriott School of Business, Department of Finance. It holds
              protected educational and personal information about our alumni so
              that staff can stay connected, offer relevant opportunities, and
              strengthen the program. We treat that information as a
              responsibility, not an asset — this page explains what we store,
              who can see it, and how it is protected.
            </p>
          </div>

          <Section icon={Database} title="What information we store">
            <p>
              For each alumnus the database may contain the following categories
              of information, collected from university records, program
              participation, and direct outreach:
            </p>
            <ul className="ml-4 list-disc space-y-1.5 marker:text-gray-400">
              <li>
                <span className="font-medium text-gray-900">Contact</span> —
                name, email and phone numbers, mailing address, and LinkedIn
                profile.
              </li>
              <li>
                <span className="font-medium text-gray-900">Education</span> —
                graduation year, degrees, majors, and Finance program
                participation.
              </li>
              <li>
                <span className="font-medium text-gray-900">Employment</span> —
                current and past employers, titles, industry, and location.
              </li>
              <li>
                <span className="font-medium text-gray-900">Engagement</span> —
                event attendance, logged interactions, mentoring and speaking
                interests, leadership roles, tags, and staff notes.
              </li>
            </ul>
          </Section>

          <Section icon={ShieldCheck} title="FERPA and BYU data governance">
            <p>
              Much of this information constitutes a protected education record
              under the Family Educational Rights and Privacy Act (FERPA) and is
              additionally governed by BYU&rsquo;s data-governance and
              information-security policies. We handle it accordingly: access is
              limited to legitimate institutional purposes, and the data is not
              made available to the public or to any party outside the
              university&rsquo;s authorized staff.
            </p>
          </Section>

          <Section icon={Users} title="Who can access it">
            <p>
              Access is role-based and follows the principle of least privilege
              — each person sees only what their role requires:
            </p>
            <ul className="ml-4 list-disc space-y-1.5 marker:text-gray-400">
              <li>
                <span className="font-medium text-gray-900">Professors</span>{" "}
                have read-only access for advising and outreach; editing,
                import, and export controls are hidden from them.
              </li>
              <li>
                <span className="font-medium text-gray-900">Students</span>{" "}
                (student employees) may update existing alumni records as part of
                their work, but cannot export data or administer the system.
              </li>
              <li>
                <span className="font-medium text-gray-900">Full-access</span>{" "}
                staff (career directors and operations staff) manage records and
                may export profile data when there is a legitimate business need.
              </li>
              <li>
                <span className="font-medium text-gray-900">Administrators</span>{" "}
                additionally manage user accounts, roles, and the audit log.
              </li>
            </ul>
            <p>
              Every role boundary is enforced on the server — the interface only
              reflects what a given user is permitted to do.
            </p>
          </Section>

          <Section icon={History} title="Access is audit-logged">
            <p>
              Changes to alumni records, along with sensitive actions such as
              exporting a profile, are recorded in an audit log. The log captures
              who performed the action and when, so that access to protected
              information remains accountable and reviewable by administrators.
            </p>
          </Section>

          <Section icon={Lock} title="We do not sell or share your data">
            <p>
              Alumni information in this database is never sold, rented, or shared
              with advertisers, data brokers, or any external organization. It is
              used solely to support the BYU Finance program and its alumni
              community. Information is transmitted over encrypted connections and
              stored within the university&rsquo;s approved systems.
            </p>
          </Section>

          <Section icon={Trash2} title="Data minimization and retention">
            <p>
              We collect only the information needed to support alumni
              engagement, and we keep it only as long as it serves that purpose.
              Records are reviewed for accuracy, deceased and inactive alumni are
              marked rather than left misleading, and outdated or unnecessary
              information is corrected or removed. Alumni may request that their
              information be reviewed, corrected, or removed.
            </p>
          </Section>

          <Section icon={Mail} title="Questions or requests">
            <p>
              If you have questions about how your information is handled, or wish
              to review, correct, or remove your data, please contact the BYU
              Finance program office at the Marriott School of Business. We will
              respond promptly and work with the university&rsquo;s data-governance
              and registrar&rsquo;s offices as needed.
            </p>
          </Section>

          <p className="px-1 pb-2 text-xs text-gray-500">
            This statement describes current internal data-handling practices for
            the BYU Finance Alumni Database and may be updated as those practices
            evolve.
          </p>
        </div>
      </main>
    </>
  );
}
