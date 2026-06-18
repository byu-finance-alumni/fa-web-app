import { Topbar } from "@/components/shell/Topbar";
import { TopbarSearch } from "@/components/shared/TopbarSearch";

export const metadata = {
  title: "Privacy & data handling",
};

/**
 * Privacy & data-handling statement, laid out as a plain document (a single
 * white "sheet" with a title and numbered sections) rather than a card grid —
 * it reads like a policy document, not a dashboard.
 */
export default function PrivacyPage() {
  return (
    <>
      <Topbar title="Privacy & data handling">
        <TopbarSearch />
      </Topbar>

      <main className="flex-1 overflow-y-auto bg-gray-100 p-4 md:p-8">
        <article className="mx-auto max-w-3xl rounded-lg border border-gray-300 bg-white px-8 py-10 text-[15px] leading-7 text-gray-800 shadow-sm md:px-14 md:py-14">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Privacy &amp; Data Handling
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              BYU Marriott School of Business &middot; Department of Finance
            </p>
          </header>

          <p>
            The BYU Finance Alumni Database is an internal tool of the BYU
            Marriott School of Business, Department of Finance. It holds
            protected educational and personal information about our alumni so
            that staff can stay connected, offer relevant opportunities, and
            strengthen the program. We treat that information as a
            responsibility, not an asset. This statement explains what we store,
            who can see it, and how it is protected.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            1. What information we store
          </h2>
          <p className="mt-2">
            For each alumnus the database may contain the following categories
            of information, collected from university records, program
            participation, and direct outreach:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Contact</span> — name, email and
              phone numbers, mailing address, and LinkedIn profile.
            </li>
            <li>
              <span className="font-semibold">Education</span> — graduation
              year, degrees, majors, and Finance program participation.
            </li>
            <li>
              <span className="font-semibold">Employment</span> — current and
              past employers, titles, industry, and location.
            </li>
            <li>
              <span className="font-semibold">Engagement</span> — event
              attendance, logged interactions, mentoring and speaking interests,
              leadership roles, tags, and staff notes.
            </li>
          </ul>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            2. FERPA and BYU data governance
          </h2>
          <p className="mt-2">
            Much of this information constitutes a protected education record
            under the Family Educational Rights and Privacy Act (FERPA) and is
            additionally governed by BYU&rsquo;s data-governance and
            information-security policies. We handle it accordingly: access is
            limited to legitimate institutional purposes, and the data is not
            made available to the public or to any party outside the
            university&rsquo;s authorized staff.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            3. Who can access it
          </h2>
          <p className="mt-2">
            Access is role-based and follows the principle of least privilege —
            each person sees only what their role requires:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <span className="font-semibold">Professors</span> have read-only
              access for advising and outreach; editing, import, and export
              controls are hidden from them.
            </li>
            <li>
              <span className="font-semibold">Students</span> (student
              employees) may update existing alumni records as part of their
              work, but cannot export data or administer the system.
            </li>
            <li>
              <span className="font-semibold">Full-access</span> staff (career
              directors and operations staff) manage records and may export
              profile data when there is a legitimate business need.
            </li>
            <li>
              <span className="font-semibold">Administrators</span> additionally
              manage user accounts, roles, and the audit log.
            </li>
          </ul>
          <p className="mt-2">
            Every role boundary is enforced on the server — the interface only
            reflects what a given user is permitted to do.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            4. Access is audit-logged
          </h2>
          <p className="mt-2">
            Changes to alumni records, along with sensitive actions such as
            exporting a profile, are recorded in an audit log. The log captures
            who performed the action and when, so that access to protected
            information remains accountable and reviewable by administrators.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            5. We do not sell or share your data
          </h2>
          <p className="mt-2">
            Alumni information in this database is never sold, rented, or shared
            with advertisers, data brokers, or any external organization. It is
            used solely to support the BYU Finance program and its alumni
            community. Information is transmitted over encrypted connections and
            stored within the university&rsquo;s approved systems.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            6. Data minimization and retention
          </h2>
          <p className="mt-2">
            We collect only the information needed to support alumni engagement,
            and we keep it only as long as it serves that purpose. Records are
            reviewed for accuracy, deceased and inactive alumni are marked rather
            than left misleading, and outdated or unnecessary information is
            corrected or removed. Alumni may request that their information be
            reviewed, corrected, or removed.
          </p>

          <h2 className="mt-8 text-lg font-bold text-gray-900">
            7. Questions or requests
          </h2>
          <p className="mt-2">
            If you have questions about how your information is handled, or wish
            to review, correct, or remove your data, please contact the BYU
            Finance program office at the Marriott School of Business. We will
            respond promptly and work with the university&rsquo;s data-governance
            and registrar&rsquo;s offices as needed.
          </p>

          <hr className="my-8 border-gray-200" />
          <p className="text-sm text-gray-500">
            This statement describes current internal data-handling practices
            for the BYU Finance Alumni Database and may be updated as those
            practices evolve.
          </p>
        </article>
      </main>
    </>
  );
}
