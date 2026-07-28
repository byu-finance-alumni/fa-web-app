import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { SurveySampleEditor } from "@/components/needs-surveying/SurveySampleEditor";
import { SurveyMessageEditor } from "@/components/needs-surveying/SurveyMessageEditor";
import { SurveyCampaignConsole } from "@/components/needs-surveying/SurveyCampaignConsole";

/**
 * "Needs Surveying" — the annual "confirm your info" re-survey surface.
 *
 * Alumni are re-surveyed once a year to keep their contact + career info fresh.
 * The eventual campaign emails each due alum (via Resend) a "confirm your info"
 * form. That send flow isn't wired up yet; what IS live here is authoring and
 * previewing the survey itself — the "Sample survey" button opens an inline
 * editor + preview of the exact questions an alum would receive (persisted
 * locally so edits survive reloads).
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
                details so the database stays accurate. Author the exact
                questions here, preview them as an alum would see them, then
                (soon) send the request by email.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <SurveySampleEditor />
              <SurveyMessageEditor />
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
