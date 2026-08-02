import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { SurveyPreview } from "@/components/needs-surveying/SurveyPreview";
import { SurveyMessageEditor } from "@/components/needs-surveying/SurveyMessageEditor";
import { SurveyBulkScheduler } from "@/components/needs-surveying/SurveyBulkScheduler";
import { SurveyCampaignConsole } from "@/components/needs-surveying/SurveyCampaignConsole";

/**
 * "Needs Surveying" — the annual "confirm your info" re-survey surface.
 *
 * Alumni are re-surveyed once a year to keep their contact + career info fresh.
 * The campaign emails each due alum (via Resend) a "confirm your info" form.
 * The "Sample survey" button previews that form exactly as the alum meets it —
 * it renders the live survey's own screens (`components/survey/survey-screens`)
 * over a sample record, so it cannot drift from what is actually sent.
 */
export default function NeedsSurveyingPage() {
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
              <SurveyPreview />
              <SurveyMessageEditor />
              <SurveyBulkScheduler />
            </div>
          </div>
        </Card>

        {/* By-class re-survey campaign console (frontend-only PROTOTYPE — no
            backend for survey campaigns yet; all sends/submits are staged in
            local state and no email or record write happens). */}
        <div className="mt-4">
          <SurveyCampaignConsole />
        </div>
      </main>
    </>
  );
}
