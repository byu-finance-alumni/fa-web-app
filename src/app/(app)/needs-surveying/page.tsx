import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { SurveyPreview } from "@/components/needs-surveying/SurveyPreview";
import { SurveyMessageEditor } from "@/components/needs-surveying/SurveyMessageEditor";
import { SurveyBulkScheduler } from "@/components/needs-surveying/SurveyBulkScheduler";
import { SurveyCampaignConsole } from "@/components/needs-surveying/SurveyCampaignConsole";
import { apiGet } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { isEngineer } from "@/constants/roles";
import {
  engineerSupportContact,
  surveySupportContact,
} from "@/lib/survey-reset-contact";
import type { ResetContact } from "@/lib/survey-reset-contact";
import type { SupportContact } from "@/types/support";

/**
 * "Needs Surveying" — the annual "confirm your info" re-survey surface.
 *
 * Alumni are re-surveyed once a year to keep their contact + career info fresh.
 * The campaign emails each due alum (via Resend) a "confirm your info" form.
 * The "Sample survey" button previews that form exactly as the alum meets it —
 * it renders the live survey's own screens (`components/survey/survey-screens`)
 * over a sample record, so it cannot drift from what is actually sent.
 */

/**
 * Who is reading this page, for the one control that depends on it (#658): the
 * per-alumnus survey reset, which is engineer-only on the backend.
 *
 * FAILS CLOSED. A `/auth/context` we could not read means "no reset button and
 * here's who to ask", never "assume engineer" — the console's reset would 403
 * on click, and a control that fails on press is worse than one that explains
 * itself. This is UX only; the backend re-enforces `RequireEngineer` regardless.
 *
 * The support contacts are fetched for EVERYONE who can see this page, not just
 * non-engineers. They used to be skipped for an engineer, who needs no "ask
 * this person" sentence — but the sample survey now shows the survey's public
 * contact too (#774), and an engineer previewing an empty contact line while
 * alumni see a populated one is exactly the sample-survey drift this dialog
 * exists to prevent. One request, both answers.
 */
async function resetAudience(): Promise<{
  isEngineer: boolean;
  engineerContact: ResetContact | null;
  surveyContact: ResetContact | null;
}> {
  let engineer = false;
  try {
    engineer = isEngineer((await getAuthContext()).roles);
  } catch {
    /* fail closed — see above */
  }

  let contacts: SupportContact[] = [];
  try {
    contacts = await apiGet<SupportContact[]>("/support-contacts");
  } catch {
    // No contacts is a supported state, not an error: the copy falls back to
    // the Finance Department by name, with no invented address, and the sample
    // survey's contact line renders nothing — matching what the alum would see.
  }
  return {
    isEngineer: engineer,
    // An engineer is the engineer; there is nobody to tell them to ask.
    engineerContact: engineer ? null : engineerSupportContact(contacts),
    surveyContact: surveySupportContact(contacts),
  };
}

export default async function NeedsSurveyingPage() {
  const { isEngineer: engineer, engineerContact, surveyContact } =
    await resetAudience();

  return (
    <>
      <Topbar title="Needs Surveying" />
      <main className="flex-1 overflow-auto p-6">
        {/* Campaign console header — navy identity matching the surveying area. */}
        <Card className="overflow-hidden border-navy-800 bg-navy-800 text-white">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue-300">
                Re-survey campaign
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">
                Confirm-your-info re-survey
              </h1>
              <p className="mt-1 text-sm text-white/80">
                Once a year we ask alumni to confirm their contact and career
                details so the database stays accurate. Preview the survey
                exactly as an alum sees it, then send the request by email.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <SurveyPreview surveyContact={surveyContact} />
              <SurveyMessageEditor />
              <SurveyBulkScheduler />
            </div>
          </div>
        </Card>

        {/* By-class re-survey campaign console (frontend-only PROTOTYPE — no
            backend for survey campaigns yet; all sends/submits are staged in
            local state and no email or record write happens). */}
        <div className="mt-4">
          <SurveyCampaignConsole
            isEngineer={engineer}
            engineerContact={engineerContact}
          />
        </div>
      </main>
    </>
  );
}
