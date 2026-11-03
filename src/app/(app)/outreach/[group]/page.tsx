import { notFound } from "next/navigation";
import { LoadError } from "@/components/shared/LoadError";
import { IndustryBarList } from "@/components/shared/IndustryBarList";
import { OutreachListLinks } from "@/components/outreach/OutreachListLinks";
import { Topbar } from "@/components/shell/Topbar";
import { Card } from "@/components/ui/card";
import { ApiError, apiGet } from "@/lib/api";
import {
  isOutreachGroupKey,
  mentorChartRows,
  mentorIndustryLinks,
  outreachGroupLabel,
  showMentorChart,
  type OutreachGroupSummary,
} from "@/lib/outreach";

/**
 * An Outreach landing page — Conference Interest, Event Speakers, Event
 * Sponsors or Alumni Mentors: every list with its count, like NetTreks. The
 * nav entries are gated on `alumni.export`, and so is `GET /outreach/{group}`:
 * someone who reaches this URL without it gets the backend's 403 rendered as
 * the shared error card. The backend decides who is on each list.
 *
 * Alumni Mentors also draws a bar of mentors per industry (the dashboard's
 * Industry breakdown component) once there are enough mentors for it to say
 * something — see `showMentorChart`.
 */
export default async function OutreachGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  if (!isOutreachGroupKey(group)) notFound();

  let data: OutreachGroupSummary | null = null;
  let error: ApiError | null = null;
  try {
    data = await apiGet<OutreachGroupSummary>(`/outreach/${group}`);
  } catch (e) {
    error = e instanceof ApiError ? e : new ApiError(0, "Failed to load the lists.");
  }

  const title = data?.title ?? outreachGroupLabel(group);

  return (
    <>
      <Topbar title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-5">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>

          {error ? (
            <LoadError status={error.status} noun="these lists" />
          ) : group === "mentors" ? (
            <MentorLists links={data!.links} />
          ) : (
            <OutreachListLinks group={group} links={data!.links} heading="Lists" />
          )}
        </div>
      </main>
    </>
  );
}

function MentorLists({ links }: { links: OutreachGroupSummary["links"] }) {
  const byIndustry = mentorIndustryLinks(links);
  const women = links.filter((l) => l.key === "women");
  return (
    <div className="space-y-5">
      {showMentorChart(links) && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Mentors by industry
          </h2>
          <IndustryBarList
            rows={mentorChartRows(links)}
            emptyLabel="No mentors yet."
            linkLabel={(r) => `View ${r.label} mentors (${r.count})`}
          />
        </Card>
      )}
      <OutreachListLinks
        group="mentors"
        links={byIndustry}
        heading="Mentors by industry"
        emptyLabel="No alumni have offered to mentor yet."
      />
      <OutreachListLinks group="mentors" links={women} heading="Women in finance" />
    </div>
  );
}
