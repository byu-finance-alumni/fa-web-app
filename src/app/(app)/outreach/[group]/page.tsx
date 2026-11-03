import { notFound } from "next/navigation";
import { LoadError } from "@/components/shared/LoadError";
import { MentorLists } from "@/components/outreach/MentorLists";
import { OutreachListLinks } from "@/components/outreach/OutreachListLinks";
import { Topbar } from "@/components/shell/Topbar";
import { ApiError, apiGet } from "@/lib/api";
import {
  isOutreachGroupKey,
  outreachGroupLabel,
  type OutreachGroupSummary,
} from "@/lib/outreach";

/**
 * An Outreach landing page — Conference Interest, Event Speakers, Event
 * Sponsors or Alumni Mentors: every list with its count, like NetTreks. The
 * nav entries are gated on `alumni.export`, and so is `GET /outreach/{group}`:
 * someone who reaches this URL without it gets the backend's 403 rendered as
 * the shared error card. The backend decides who is on each list.
 *
 * Alumni Mentors draws each industry's link with its own bar and count once
 * there are enough mentors for bars to say something — see `showMentorChart`.
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
