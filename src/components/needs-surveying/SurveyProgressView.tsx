"use client";

import { useEffect, useState } from "react";

import { clientGet } from "@/lib/api-client";
import { CampaignProgressTable } from "@/components/needs-surveying/CampaignProgressTable";
import type { components } from "@/types/api.gen";

type SurveyScheduleItem = components["schemas"]["SurveyScheduleItem"];

/**
 * The Progress tab on its own, for `surveys.progress` holders (students) who
 * do NOT hold `surveys.manage`.
 *
 * Deliberately NOT `SurveyCampaignConsole` with its controls hidden. The
 * console fetches usage, send caps, graduation years, recipient breakdowns and
 * the review queue on mount — all `surveys.manage`-only, so every one would
 * 403 — and hiding its buttons one by one is a list that a future control can
 * silently fall off. This component makes exactly the requests the backend
 * opens to `surveys.progress`, and nothing else:
 *
 *   • GET /survey/schedules — the counts (the console's own source for them);
 *   • GET /survey/schedules/{year}/responders — the hover names, on demand,
 *     from inside `CampaignProgressTable`;
 *   • the Replied / No reply yet exports — `alumni.export`, and only when
 *     `canExport`.
 *
 * Re-reads on the same `survey:schedules-changed` event the console listens to,
 * though for a student nothing on this page fires it.
 */
export function SurveyProgressView({ canExport = false }: { canExport?: boolean }) {
  const [schedules, setSchedules] = useState<SurveyScheduleItem[] | null>(null);
  /** True when the schedules read failed — NOT the same as "no campaigns". */
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      clientGet<SurveyScheduleItem[]>("/survey/schedules")
        .then((s) => {
          if (cancelled) return;
          setSchedules(s ?? []);
          setFailed(false);
        })
        // An empty array would read as "no campaigns yet" (#688); say it failed.
        .catch(() => {
          if (cancelled) return;
          setSchedules([]);
          setFailed(true);
        });
    };
    load();
    window.addEventListener("survey:schedules-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("survey:schedules-changed", load);
    };
  }, []);

  return (
    <CampaignProgressTable
      schedules={schedules}
      failed={failed}
      canExport={canExport}
    />
  );
}
