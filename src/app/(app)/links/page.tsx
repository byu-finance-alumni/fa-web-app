import Link from "next/link";
import { ScrollToTopOnPageChange } from "@/components/shared/ScrollToTopOnPageChange";
import { ApiError, apiGet } from "@/lib/api";
import { readAuthContext } from "@/lib/auth-context";
import { canDeleteLinks, canManageSurveys } from "@/constants/capabilities";
import { LoadError } from "@/components/shared/LoadError";
import { Topbar } from "@/components/shell/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinksBulkDeleteBar } from "@/components/links/LinksBulkDeleteBar";
import { LinksSelectionProvider } from "@/components/links/LinksSelection";
import { LinksTable } from "@/components/links/LinksTable";
import { LinksToolbar } from "@/components/links/LinksToolbar";
import {
  LINKS_PAGE_SIZE,
  STATUS_LABELS,
  hasActiveLinkFilters,
  linksDateRangeError,
  linksHref,
  parseLinksFilters,
  parseLinksOffset,
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
 *
 * DELETING is a THIRD tier, gated on its own `links.delete` capability — seeded
 * to Super Admin and Engineer, and deliberately not held by Full Access even
 * though they keep `surveys.manage` for approve/reject. Approve and reject are
 * reversible bookkeeping; delete destroys the row. The blue Edit button and the
 * whole selection mode behind it appear only for holders of that capability.
 */

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<LinksSearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseLinksFilters(sp);
  const offset = parseLinksOffset(sp);

  // Fail closed on a DENIAL: a 401/403 on /auth/context means no review
  // controls, never "assume they can review". A control that 403s on click is
  // worse than one that was never offered — and doubly so for the delete
  // control, where the failure mode of guessing wrong is offering someone a
  // destructive action.
  //
  // A fault is not a denial though (#688). If the context call 5xx'd or never
  // landed we do not KNOW what they hold, and rendering the page as a plain
  // approved-links list would quietly tell a reviewer their queue is gone. That
  // case falls through to the error state below instead.
  let canReview = false;
  let canDelete = false;
  const auth = await readAuthContext();
  if (auth.status === "ok") {
    const { capabilities } = auth.ctx;
    canReview = canManageSurveys(capabilities);
    // `links.delete` is a SEPARATE capability from `surveys.manage`, not a
    // stronger reading of it: Full Access approves and rejects but does not
    // delete. Never infer one from the other, and never from the role name.
    canDelete = canDeleteLinks(capabilities);
  }

  // A non-reviewer cannot see anything but approved links, so a deep link
  // carrying ?status=pending is normalised here rather than sent on to a
  // guaranteed 403.
  const effectiveFilters = canReview
    ? filters
    : { ...filters, status: "approved" as const };

  // The one filter combination the backend answers with a 422 rather than an
  // empty page: a received-from date after the received-to date. Caught here so
  // the screen says "your dates are the wrong way round" instead of rendering
  // the empty state, which reads as a fact about the data (#771).
  const rangeError = linksDateRangeError(effectiveFilters);

  let data: OpportunityLinkPage | null = null;
  // An unreadable capability list is itself a load failure — surface it with the
  // same card rather than silently downgrading the page to the read-only view.
  let error: ApiError | null =
    auth.status === "unavailable"
      ? new ApiError(auth.httpStatus ?? 0, "Failed to read your access.")
      : null;

  if (!error && !rangeError) {
    try {
      data = await apiGet<OpportunityLinkPage>(
        `/opportunity-links?${toLinksApiQuery(effectiveFilters, {
          limit: LINKS_PAGE_SIZE,
          offset,
        })}`,
      );
    } catch (e) {
      error = e instanceof ApiError ? e : new ApiError(0, "Failed to load links.");
    }
  }

  const rows = data?.items ?? null;
  // The ids selection mode is allowed to act on: exactly what is on screen.
  const pageIds = (rows ?? []).map((r) => r.opportunity_link_id);
  // Rendered once here and passed down so the age column agrees with itself
  // across hydration — the table is a client component now.
  const now = new Date();
  const from = data && data.total > 0 ? offset + 1 : 0;
  const to = data ? Math.min(offset + LINKS_PAGE_SIZE, data.total) : 0;
  const hasPrev = offset > 0;
  const hasNext = data ? offset + LINKS_PAGE_SIZE < data.total : false;

  return (
    <>
      <Topbar title="Internship Links" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <ScrollToTopOnPageChange offset={offset} />
        {/* Selection mode spans the toolbar (the Edit button), the bar under it
            (count + Delete) and the table (the checkboxes), so all three sit
            inside one provider. The state is ephemeral and deliberately NOT in
            the URL — see the component for why. */}
        <LinksSelectionProvider canDelete={canDelete} pageIds={pageIds}>
          <LinksToolbar
            initial={effectiveFilters}
            canReview={canReview}
            createHref={canReview ? "/links/new" : null}
          />

          <LinksBulkDeleteBar />

          {error ? (
            <LoadError status={error.status} noun="links" />
          ) : rangeError ? (
            // Not a LoadError: nothing broke and there is nothing to retry — the
            // dates just need swapping, and the card says which ones.
            <Card
              className="border-warning-600/40 bg-warning-50 p-10 text-center"
              role="alert"
            >
              <p className="text-sm font-semibold text-gray-900">
                Check the date range
              </p>
              <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-gray-600">
                {rangeError}
              </p>
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
              <LinksTable links={rows!} canReview={canReview} now={now} />

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
        </LinksSelectionProvider>
      </main>
    </>
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
