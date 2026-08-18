import Link from "next/link";
import { ApiError, apiGet } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { canDeleteLinks, canManageSurveys } from "@/constants/capabilities";
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

  // Fail closed: an unreadable /auth/context means no review controls, never
  // "assume they can review". A control that 403s on click is worse than one
  // that was never offered — and doubly so for the delete control, where the
  // failure mode of guessing wrong is offering someone a destructive action.
  let canReview = false;
  let canDelete = false;
  try {
    const { capabilities } = await getAuthContext();
    canReview = canManageSurveys(capabilities);
    // `links.delete` is a SEPARATE capability from `surveys.manage`, not a
    // stronger reading of it: Full Access approves and rejects but does not
    // delete. Never infer one from the other, and never from the role name.
    canDelete = canDeleteLinks(capabilities);
  } catch {
    canReview = false;
    canDelete = false;
  }

  // A non-reviewer cannot see anything but approved links, so a deep link
  // carrying ?status=pending is normalised here rather than sent on to a
  // guaranteed 403.
  const effectiveFilters = canReview
    ? filters
    : { ...filters, status: "approved" as const };

  let data: OpportunityLinkPage | null = null;
  let error: ApiError | null = null;

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
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="max-w-3xl text-sm text-gray-500">
            Internship and full-time opportunities alumni have shared. Nothing
            here expires on its own, so check the age before passing a link on.
          </p>
        </div>

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
