import Link from "next/link";
import { ApiError, apiGet } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { canManageSurveys } from "@/constants/capabilities";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinksTable } from "@/components/links/LinksTable";
import { LinksToolbar } from "@/components/links/LinksToolbar";
import {
  LINKS_PAGE_SIZE,
  STATUS_LABELS,
  hasActiveLinkFilters,
  linksHref,
  parseLinksFilters,
  parseLinksOffset,
  sampleLinksEnabled,
  toLinksApiQuery,
  type LinksSearchParams,
  type OpportunityLinkPage,
} from "@/lib/opportunityLinks";

/**
 * Links — the staff-facing list of opportunity links alumni submit through the
 * survey (api #441).
 *
 * Deliberately staff-only. The owner's decision on #441 was explicit: students
 * are NOT getting a page and distribution stays manual, so this screen is the
 * whole consumption surface. It is also the moderation queue — the existing
 * survey-response review cannot express per-link approval, because Apply and
 * Reject there act on a whole submission.
 *
 * PERMISSIONS. `GET /opportunity-links` serves approved links to any
 * authenticated user and requires the surveys-management capability for
 * `status=pending|rejected`. The nav entry is gated on that capability because
 * this is a review surface, but the page itself degrades rather than bounces:
 * someone who reaches it without the capability gets the approved list with no
 * status control and no review column. As always this is UX — the backend
 * re-checks every request, and the capability is read from `capabilities` rather
 * than from the role string because an engineer can grant it to any role (#379).
 */

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<LinksSearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseLinksFilters(sp);
  const offset = parseLinksOffset(sp);

  // Fail closed: an unreadable /auth/context means no review controls, never
  // "assume they can review". A control that 403s on click is worse than one
  // that was never offered.
  let canReview = false;
  try {
    canReview = canManageSurveys((await getAuthContext()).capabilities);
  } catch {
    canReview = false;
  }

  // A non-reviewer cannot see anything but approved links, so a deep link
  // carrying ?status=pending is normalised here rather than sent on to a
  // guaranteed 403.
  const effectiveFilters = canReview
    ? filters
    : { ...filters, status: "approved" as const };

  // Local-only sample data. See `sampleLinksEnabled` — this is impossible on any
  // deployment (NODE_ENV is "production" on every Vercel build) and additionally
  // requires an explicit opt-in flag. The import is dynamic so the fabricated
  // rows stay out of every browser bundle and out of this page's server module
  // graph; keep it that way.
  const sampleMode = sampleLinksEnabled(process.env);

  let data: OpportunityLinkPage | null = null;
  let error: ApiError | null = null;

  if (sampleMode) {
    const { sampleLinkPage } = await import("@/lib/opportunityLinks.sample");
    data = sampleLinkPage(effectiveFilters, {
      limit: LINKS_PAGE_SIZE,
      offset,
    });
  } else {
    try {
      data = await apiGet<OpportunityLinkPage>(
        `/opportunity-links?${toLinksApiQuery(effectiveFilters, {
          limit: LINKS_PAGE_SIZE,
          offset,
        })}`,
      );
    } catch (e) {
      error =
        e instanceof ApiError ? e : new ApiError(0, "Failed to load links.");
    }
  }

  const rows = data?.items ?? null;
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LINKS_PAGE_SIZE, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LINKS_PAGE_SIZE < data.total : false;

  return (
    <>
      <Topbar title="Links" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {sampleMode ? <SampleModeBanner /> : null}

        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="max-w-3xl text-sm text-gray-500">
            Internship and full-time opportunities alumni have shared. Nothing
            here expires on its own, so check the age before passing a link on.
          </p>
        </div>

        <LinksToolbar
          initial={effectiveFilters}
          canReview={canReview}
          createHref={canReview ? "/links/new" : null}
        />

        {error ? (
          <Card className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {error.status === 403
                ? "Your account isn't provisioned for this"
                : "Couldn't load links"}
            </p>
            <p className="mt-1 text-sm text-gray-500">{error.message}</p>
          </Card>
        ) : rows && rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-500">
            {hasActiveLinkFilters(effectiveFilters)
              ? "No links match your filters."
              : effectiveFilters.status === "pending"
                ? "Nothing is waiting for review."
                : "No links yet. Alumni add them through the annual survey, and staff can add one by hand."}
          </Card>
        ) : (
          <>
            <LinksTable links={rows!} canReview={canReview} />

            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span className="tabular-nums">
                Showing {from}–{to} of {data!.total}{" "}
                {STATUS_LABELS[effectiveFilters.status].toLowerCase()}
              </span>
              <div className="flex gap-2">
                <PageLink
                  href={linksHref(effectiveFilters, offset - LINKS_PAGE_SIZE)}
                  enabled={hasPrev}
                  label="‹ Prev"
                />
                <PageLink
                  href={linksHref(effectiveFilters, offset + LINKS_PAGE_SIZE)}
                  enabled={hasNext}
                  label="Next ›"
                />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

/**
 * Unmissable, and worded so nobody can mistake this for real data. It renders
 * only under `sampleLinksEnabled` (see that function for why that is impossible
 * off a developer's own machine).
 */
function SampleModeBanner() {
  return (
    <Card className="mb-4 border-warning-600/40 bg-warning-50 p-4">
      <p className="text-sm font-semibold text-warning-600">
        Sample data — local development only
      </p>
      <p className="mt-1 text-sm text-gray-700">
        Every row below is fabricated and lives only in this page render. No
        request is sent to the API, and Approve, Reject and Add link all refuse
        while this is on. Restart with <code>npm run dev</code> instead of{" "}
        <code>npm run dev:sample</code> to use real data.
      </p>
    </Card>
  );
}

function PageLink({
  href,
  enabled,
  label,
}: {
  href: string;
  enabled: boolean;
  label: string;
}) {
  return enabled ? (
    <Button asChild variant="secondary">
      <Link href={href}>{label}</Link>
    </Button>
  ) : (
    <Button variant="secondary" disabled>
      {label}
    </Button>
  );
}
