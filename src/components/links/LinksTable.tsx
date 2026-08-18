"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkReviewActions } from "@/components/links/LinkReviewActions";
import { useLinksSelection } from "@/components/links/LinksSelection";
import {
  EM_DASH,
  isLinkSelected,
  isPageFullySelected,
  isPagePartiallySelected,
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
 * words in a badge, never as an icon or a bare colour. The one control this
 * table grows is the selection checkbox, which is a form input rather than a
 * glyph and appears ONLY while selection mode is on.
 *
 * A client component because of that checkbox column: whether the column exists
 * at all is client state (see `LinksSelection`). `now` is therefore passed in by
 * the page rather than defaulted here on both sides of hydration — a server and a
 * browser in different timezones would otherwise disagree about the age label
 * across a day boundary and warn.
 */
export function LinksTable({
  links,
  canReview,
  now = new Date(),
}: {
  links: OpportunityLink[];
  /** Holder of the surveys-management permission — shows the review column. */
  canReview: boolean;
  /** Injected so the age column is deterministic in tests and across hydration. */
  now?: Date;
}) {
  const selection = useLinksSelection();
  const selecting = selection?.active ?? false;
  const selected = selection?.selected ?? [];
  const pageIds = links.map((l) => l.opportunity_link_id);

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Opportunity links submitted by alumni, newest first.
          </caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              {selecting ? (
                <th scope="col" className="w-10 px-4 py-3">
                  <SelectAllCheckbox
                    pageIds={pageIds}
                    checked={isPageFullySelected(selected, pageIds)}
                    indeterminate={isPagePartiallySelected(selected, pageIds)}
                    onChange={(next) => selection?.setPage(pageIds, next)}
                  />
                </th>
              ) : null}
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

              const rowSelected =
                selecting && isLinkSelected(selected, link.opportunity_link_id);

              return (
                <tr
                  key={link.opportunity_link_id}
                  className={`border-b border-gray-200 align-top last:border-0 ${
                    rowSelected ? "bg-brand-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  {selecting ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rowSelected}
                        onChange={() =>
                          selection?.toggle(link.opportunity_link_id)
                        }
                        aria-label={`Select ${company.label} for deletion`}
                        className="h-4 w-4 cursor-pointer accent-brand-blue-600"
                      />
                    </td>
                  ) : null}

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

/**
 * Select-all for the rows on THIS page — the header checkbox.
 *
 * "On this page" is the whole promise and it is deliberately not "all matching
 * links": the page can only name the ids it rendered, and a select-all that
 * silently armed rows nobody has seen would be a mis-click away from destroying
 * a filtered set of unknown size. The selection is pruned to the visible rows on
 * every page/filter change for the same reason (see `LinksSelection`).
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it has to be set
 * through a ref — this is the only reason this is its own component.
 */
function SelectAllCheckbox({
  pageIds,
  checked,
  indeterminate,
  onChange,
}: {
  pageIds: readonly number[];
  checked: boolean;
  indeterminate: boolean;
  onChange: (next: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={pageIds.length === 0}
      onChange={(e) => onChange(e.target.checked)}
      aria-label="Select every link on this page"
      className="h-4 w-4 cursor-pointer accent-brand-blue-600"
    />
  );
}
