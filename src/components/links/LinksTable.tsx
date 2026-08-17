import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkReviewActions } from "@/components/links/LinkReviewActions";
import {
  EM_DASH,
  ROLE_TYPE_LABELS,
  STATUS_LABELS,
  companyDisplay,
  formatLinkDate,
  isDeadlinePassed,
  isStaleLink,
  linkAgeLabel,
  linkTarget,
  locationDisplay,
  submittedByDisplay,
  type OpportunityLink,
} from "@/lib/opportunityLinks";

/**
 * The Links list table.
 *
 * TWO THINGS ARE LOAD-BEARING HERE and should survive any redesign:
 *
 *  1. `linkTarget()` stands between the stored `url` and the `href`. The value
 *     is public-submitted, so it is never handed to an anchor directly; when the
 *     scheme guard rejects it the row shows the text with NO anchor. There is no
 *     `dangerouslySetInnerHTML` anywhere in this feature and there must not be —
 *     `details` is free text an alum typed.
 *  2. The submitted date carries its AGE. Nothing about an opportunity link
 *     expires by design, so the only thing that makes a two-year-old careers
 *     link obvious is having its age on screen; past `STALE_AFTER_DAYS` the row
 *     says so outright.
 *
 * Text-only throughout (standing project rule): status and staleness read as
 * words in a badge, never as an icon or a bare colour.
 */
export function LinksTable({
  links,
  canReview,
  now = new Date(),
}: {
  links: OpportunityLink[];
  /** Holder of the surveys-management permission — shows the review column. */
  canReview: boolean;
  /** Injected so the age column is deterministic in tests and on the server. */
  now?: Date;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Opportunity links submitted by alumni, newest first.
          </caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <th scope="col" className="min-w-[16rem] px-4 py-3">
                Company
              </th>
              <th scope="col" className="w-36 px-4 py-3">
                Role type
              </th>
              <th scope="col" className="w-40 px-4 py-3">
                Location
              </th>
              <th scope="col" className="min-w-[14rem] px-4 py-3">
                Link
              </th>
              <th scope="col" className="w-44 px-4 py-3">
                Submitted by
              </th>
              <th scope="col" className="w-40 px-4 py-3">
                Submitted
              </th>
              {canReview ? (
                <th scope="col" className="w-52 px-4 py-3">
                  Review
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const company = companyDisplay(link);
              const target = linkTarget(link.url);
              const stale = isStaleLink(link.submitted_at, now);
              const deadlinePassed = isDeadlinePassed(
                link.application_deadline,
                now,
              );

              return (
                <tr
                  key={link.opportunity_link_id}
                  className="border-b border-gray-200 align-top last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-gray-900">
                        {company.label}
                      </span>
                      {company.ownCompany ? (
                        <Badge variant="tag">Their own company</Badge>
                      ) : null}
                      {company.unresolved ? (
                        <Badge variant="warning">No employer on file</Badge>
                      ) : null}
                    </div>
                    {link.details ? (
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">
                        {link.details}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-gray-700">
                      {ROLE_TYPE_LABELS[link.role_type]}
                    </span>
                    {link.application_deadline ? (
                      <p
                        className={`mt-1 text-xs ${
                          deadlinePassed ? "text-danger-600" : "text-gray-500"
                        }`}
                      >
                        {deadlinePassed ? "Closed " : "Apply by "}
                        {formatLinkDate(link.application_deadline)}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {locationDisplay(link)}
                  </td>

                  <td className="px-4 py-3">
                    {/* Public-submitted value: only ever an anchor once
                        `linkTarget` has scheme-checked it. */}
                    {target.href ? (
                      <a
                        href={target.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="break-all font-medium text-brand-blue-600 hover:underline"
                        title={target.href}
                      >
                        {target.label}
                      </a>
                    ) : (
                      <span
                        className="break-all text-gray-500"
                        title="Not a usable http(s) address — shown as text, not a link."
                      >
                        {target.label}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-700">
                    {submittedByDisplay(link)}
                    {link.source === "staff" ? (
                      <p className="mt-1 text-xs text-gray-500">Added by staff</p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <span className="tabular-nums text-gray-700">
                      {formatLinkDate(link.submitted_at)}
                    </span>
                    <p
                      className={`mt-1 text-xs ${
                        stale ? "font-medium text-warning-600" : "text-gray-500"
                      }`}
                    >
                      {linkAgeLabel(link.submitted_at, now)}
                    </p>
                  </td>

                  {canReview ? (
                    <td className="px-4 py-3">
                      {link.status === "pending" ? (
                        <LinkReviewActions
                          opportunityLinkId={link.opportunity_link_id}
                          status={link.status}
                          company={company.label}
                        />
                      ) : (
                        <>
                          <Badge
                            variant={
                              link.status === "approved" ? "success" : "muted"
                            }
                          >
                            {STATUS_LABELS[link.status]}
                          </Badge>
                          <p className="mt-1 text-xs text-gray-500">
                            {link.reviewed_by ?? EM_DASH}
                            {link.reviewed_at
                              ? ` · ${formatLinkDate(link.reviewed_at)}`
                              : ""}
                          </p>
                        </>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
