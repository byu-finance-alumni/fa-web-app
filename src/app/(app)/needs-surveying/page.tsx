import { CalendarClock, Mail, ShieldCheck } from "lucide-react";

import { Topbar } from "@/components/shell/Topbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SurveySampleEditor } from "@/components/needs-surveying/SurveySampleEditor";

/**
 * "Needs Surveying" — the biennial "confirm your info" re-survey surface.
 *
 * Alumni are re-surveyed every two years to keep their contact + career info
 * fresh. The eventual campaign emails each due alum (via Resend) a
 * "confirm your info" form. That send flow isn't wired up yet; what IS live
 * here is authoring and previewing the survey itself — the "Sample survey"
 * button opens an inline editor + preview of the exact questions an alum would
 * receive (persisted locally so edits survive reloads).
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
                Every two years we ask alumni to confirm their contact and
                career details so the database stays accurate. Author the exact
                questions here, preview them as an alum would see them, then
                (soon) send the request by email.
              </p>
            </div>

            <div className="shrink-0">
              <SurveySampleEditor />
            </div>
          </div>
        </Card>

        {/* Supporting context cards — what the survey does, cadence, and the
            not-yet-wired sending step. Real copy, no filler. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <ShieldCheck
              className="h-5 w-5 text-brand-blue-600"
              aria-hidden="true"
            />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">
              What it confirms
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Email, phone, LinkedIn, location, and current role — pre-filled
              with what we have on file so alumni only fix what changed.
            </p>
          </Card>

          <Card className="p-5">
            <CalendarClock
              className="h-5 w-5 text-brand-blue-600"
              aria-hidden="true"
            />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">
              Biennial cadence
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Alumni are due when they&apos;ve never been surveyed or their last
              completed survey is more than two years old.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <Mail
                className="h-5 w-5 text-brand-blue-600"
                aria-hidden="true"
              />
              <Badge variant="warning">Coming soon</Badge>
            </div>
            <h2 className="mt-2 text-sm font-semibold text-gray-900">
              Campaign sending
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Emailing the request to the due list isn&apos;t wired up yet. For
              now, use Sample survey to author and preview the questions.
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}
