import { OutreachListLinks } from "@/components/outreach/OutreachListLinks";
import { IndustryBarList } from "@/components/shared/IndustryBarList";
import { Card } from "@/components/ui/card";
import {
  mentorChartRows,
  mentorIndustryLinks,
  showMentorChart,
  type OutreachGroupSummary,
} from "@/lib/outreach";

/**
 * The Alumni Mentors landing page body. A Server Component.
 *
 * With enough mentors for bars (`showMentorChart`), the page is the bar graph
 * alone — every bar is a link to that industry's list — with the Women in
 * finance link under it (Jake, 2026-11-03: a links table beside or above the
 * graph listed every industry twice). With too few, it is the plain links.
 */
export function MentorLists({ links }: { links: OutreachGroupSummary["links"] }) {
  const byIndustry = mentorIndustryLinks(links);
  const women = links.filter((l) => l.key === "women");
  const womenLinks = (
    <OutreachListLinks group="mentors" links={women} heading="Women in finance" />
  );
  if (!showMentorChart(links)) {
    return (
      <div className="space-y-5">
        <OutreachListLinks
          group="mentors"
          links={byIndustry}
          heading="Mentors by industry"
          emptyLabel="No alumni have offered to mentor yet."
        />
        {womenLinks}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Mentors by industry</h2>
        <IndustryBarList
          rows={mentorChartRows(links)}
          emptyLabel="No mentors yet."
          linkLabel={(r) => `View ${r.label} mentors (${r.count})`}
        />
      </Card>
      {womenLinks}
    </div>
  );
}
