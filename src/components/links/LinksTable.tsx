"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkDetailPanel } from "@/components/links/LinkDetailPanel";
import { LinkReviewActions } from "@/components/links/LinkReviewActions";
import { useLinksSelection } from "@/components/links/LinksSelection";
import {
  EM_DASH,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  companyDisplay,
  formatLinkDate,
  isDeadlinePassed,
  isLinkSelected,
  isPageFullySelected,
  isPagePartiallySelected,
  isStaleLink,
  linkAgeLabel,
  linkRowAction,
  locationDisplay,
  shortLinkTarget,
  submittedByDisplay,
  type OpportunityLink,
} from "@/lib/opportunityLinks";

/**
 * The Links list table.
 *
 * SHAPE (the owner's ask, 2026-08-17): a spreadsheet. Every field gets its own
 * column, every cell is ONE line, anything longer is cut with an ellipsis, and
 * the row you click opens {@link LinkDetailPanel} with the whole record. Nothing
 * stacks a second line under a cell any more — that stacking is what made the
 * rows tall, and the panel is what buys the right to throw it away: if a value
 * is truncated here it is untruncated there, every time. A column added below
 * has to earn a one-line rendering or it does not belong in the list.
 *
 * THREE THINGS ARE LOAD-BEARING HERE and should survive any redesign:
 *
 *  1. `shortLinkTarget()` — and `linkTarget()` beneath it — stands between the
 *     stored `url` and the `href`. The value is public-submitted, so it is never
 *     handed to an anchor directly; when the scheme guard rejects it the row
 *     shows the text with NO anchor. Shortening is a DISPLAY transform: the href
 *     is always the full, guarded URL, never the ellipsised label. There is no
 *     `dangerouslySetInnerHTML` anywhere in this feature and there must not be —
 *     `details` is free text an alum typed.
 *  2. The Submitted column carries the AGE, not the date. Nothing about an
 *     opportunity link expires by design, so the only thing that makes a
 *     two-year-old careers link obvious is having its age on screen; past
 *     `STALE_AFTER_DAYS` it is coloured as well as worded. The exact date is one
 *     click away in the panel, and on the cell's tooltip.
 *  3. Row clicks are arbitrated by `linkRowAction()`, not by whoever wired a
 *     handler last. Selection mode wins over the panel, and a control inside the
 *     row (the link, the checkbox, Approve/Reject) wins over both — see that
 *     function for why each case exists.
 *
 * Text-only throughout (standing project rule): status, staleness and source
 * read as words, never as an icon or a bare colour, and the panel closes on a
 * button that says "Close". The one control this table grows is the selection
 * checkbox, which is a form input rather than a glyph and appears ONLY while
 * selection mode is on.
 *
 * A client component because of the checkbox column and the panel. `now` is
 * passed in by the page rather than defaulted here on both sides of hydration —
 * a server and a browser in different timezones would otherwise disagree about
 * the age label across a day boundary and warn.
 */
/**
 * First `count` words of `text`, with an ellipsis when anything was dropped.
 *
 * The Details column is a scanning aid, not the content: the owner asked for
 * roughly three words so the column stays narrow and the eye can run down it.
 * The full text is one row-click away in the detail panel and is also on the
 * cell as a `title`, so nothing is hidden, only deferred.
 *
 * Deliberately local to this table rather than in `lib/opportunityLinks`: it is
 * a presentation choice for this one column, not part of the link model.
 */
export function firstWords(text: string, count: number): string {
  const words = text.trim().split(/s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length <= count) return words.join(" ");
  return words.slice(0, count).join(" ") + "…";
}

/**
 * The destination host, for the Link column: `https://careers.adobe.com/x` ->
 * `careers.adobe.com`. Shows a reviewer WHERE a public-submitted link goes
 * before they click it, which a generic "Link" label cannot.
 *
 * Only ever called with an href `linkTarget` already scheme-checked, so the
 * parse cannot throw on anything we would render; the catch is belt-and-braces
 * and falls back to the full value rather than showing nothing.
 */
export function linkDomain(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www./i, "");
  } catch {
    return href;
  }
}

/** How many words of `details` the column shows before the ellipsis. */
export const DETAILS_PREVIEW_WORDS = 3;

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

  /** The row whose full record is open, or `null`. */
  const [detail, setDetail] = useState<OpportunityLink | null>(null);

  // Entering selection mode with a panel open would leave a dialog floating over
  // a list the user has just switched into a different mode.
  useEffect(() => {
    if (selecting) setDetail(null);
  }, [selecting]);

  const handleRowClick = (
    event: React.MouseEvent<HTMLTableRowElement>,
    link: OpportunityLink,
  ) => {
    // Belt to the controls' own stopPropagation braces: anything that came from
    // an anchor, a checkbox or a review button has already handled itself.
    const target = event.target;
    const fromControl =
      target instanceof Element &&
      target.closest("a, button, input, label") !== null;

    switch (linkRowAction({ selecting, fromControl })) {
      case "toggle-selection":
        selection?.toggle(link.opportunity_link_id);
        break;
      case "open-detail":
        setDetail(link);
        break;
      case "ignore":
        break;
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table
          className={`w-full table-fixed text-sm ${
            canReview ? "min-w-[82rem]" : "min-w-[68rem]"
          }`}
        >
          <caption className="sr-only">
            Opportunity links submitted by alumni, newest first. Every cell is
            shortened to one line — open a row for the full record.
          </caption>
          {/* Fixed layout + explicit shares: without a definite width a cell
              cannot ellipsise, and without ellipsising the rows grow back. */}
          <colgroup>
            {selecting ? <col className="w-10" /> : null}
            <col className="w-[19%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[11%]" />
            {canReview ? <col className="w-[13rem]" /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {selecting ? (
                <th scope="col" className="px-3 py-2">
                  <SelectAllCheckbox
                    pageIds={pageIds}
                    checked={isPageFullySelected(selected, pageIds)}
                    indeterminate={isPagePartiallySelected(selected, pageIds)}
                    onChange={(next) => selection?.setPage(pageIds, next)}
                  />
                </th>
              ) : null}
              <th scope="col" className="px-3 py-2">
                Company
              </th>
              <th scope="col" className="px-3 py-2">
                Role
              </th>
              <th scope="col" className="px-3 py-2">
                Location
              </th>
              <th scope="col" className="px-3 py-2">
                Link
              </th>
              <th scope="col" className="px-3 py-2">
                Details
              </th>
              <th scope="col" className="px-3 py-2">
                Submitted by
              </th>
              <th scope="col" className="px-3 py-2">
                Submitted
              </th>
              <th scope="col" className="px-3 py-2">
                Deadline
              </th>
              {canReview ? (
                <th scope="col" className="px-3 py-2">
                  Review
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const company = companyDisplay(link);
              const target = shortLinkTarget(link.url);
              const stale = isStaleLink(link.submitted_at, now);
              const deadlinePassed = isDeadlinePassed(
                link.application_deadline,
                now,
              );
              const details = link.details?.trim() ?? "";
              const detailsPreview = firstWords(details, DETAILS_PREVIEW_WORDS);

              const rowSelected =
                selecting && isLinkSelected(selected, link.opportunity_link_id);

              return (
                <tr
                  key={link.opportunity_link_id}
                  onClick={(e) => handleRowClick(e, link)}
                  className={`cursor-pointer border-b border-gray-200 last:border-0 ${
                    rowSelected ? "bg-brand-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  {selecting ? (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={rowSelected}
                        onChange={() =>
                          selection?.toggle(link.opportunity_link_id)
                        }
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${company.label} for deletion`}
                        className="h-4 w-4 cursor-pointer accent-brand-blue-600"
                      />
                    </td>
                  ) : null}

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {/* The keyboard route into the panel. A real button rather
                          than a tabbable <tr>: it keeps the table a table for a
                          screen reader, and it is the row's name, so its
                          accessible name is already the right one. */}
                      {selecting ? (
                        <span className="font-semibold text-gray-900">
                          {company.label}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(link);
                          }}
                          className="rounded-sm text-left font-semibold text-gray-900 hover:text-brand-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
                          title={`${company.label} — open the full record`}
                        >
                          {company.label}
                        </button>
                      )}
                      {/* Compact markers, not a badge stack: "no employer on
                          file" is a gap in OUR data and a reviewer has to be
                          able to spot it down the column at a glance. */}
                      {company.ownCompany ? (
                        <Badge
                          variant="tag"
                          size="sm"
                          className="shrink-0"
                          title="Submitted as the alum's own company"
                        >
                          Own
                        </Badge>
                      ) : null}
                      {company.unresolved ? (
                        <Badge
                          variant="warning"
                          size="sm"
                          className="shrink-0"
                          title="Own company, but no employer is on file for this alum"
                        >
                          No employer
                        </Badge>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 text-gray-700">
                    {ROLE_TYPE_LABELS[link.role_type]}
                  </td>

                  <td className="px-3 py-2.5 text-gray-700">
                    {locationDisplay(link)}
                  </td>

                  <td className="px-3 py-2.5">
                    {/* Public-submitted value: only ever an anchor once
                        `linkTarget` has scheme-checked it, and the href is
                        always the FULL url — never the shortened label. */}
                    {target.href ? (
                      <a
                        href={target.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium text-brand-blue-600 hover:underline"
                        title={target.href}
                      >
                        {linkDomain(target.href)}
                      </a>
                    ) : (
                      <span
                        className="text-gray-500"
                        title={`Not a usable http(s) address, so it is not linked: ${target.label}`}
                      >
                        Not a link
                      </span>
                    )}
                  </td>

                  <td
                    className="truncate px-3 py-2.5 text-gray-500"
                    title={details || undefined}
                  >
                    {detailsPreview || EM_DASH}
                  </td>

                  <td className="truncate px-3 py-2.5 text-gray-700">
                    {submittedByDisplay(link)}
                    <span className="text-gray-400">
                      {" "}
                      · {SOURCE_LABELS[link.source]}
                    </span>
                  </td>

                  <td
                    className={`truncate px-3 py-2.5 tabular-nums ${
                      stale ? "font-medium text-warning-600" : "text-gray-700"
                    }`}
                    title={`Submitted ${formatLinkDate(link.submitted_at)}`}
                  >
                    {linkAgeLabel(link.submitted_at, now)}
                  </td>

                  <td
                    className={`truncate px-3 py-2.5 tabular-nums ${
                      deadlinePassed ? "text-danger-600" : "text-gray-700"
                    }`}
                  >
                    {link.application_deadline
                      ? `${deadlinePassed ? "Closed " : ""}${formatLinkDate(
                          link.application_deadline,
                        )}`
                      : EM_DASH}
                  </td>

                  {canReview ? (
                    <td className="px-3 py-2.5">
                      {/* Approve/Reject act on the row; they must not also open
                          it. The wrapper catches clicks that miss a button but
                          still land in the cell. */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {link.status === "pending" ? (
                          <LinkReviewActions
                            opportunityLinkId={link.opportunity_link_id}
                            status={link.status}
                            company={company.label}
                          />
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Badge
                              variant={
                                link.status === "approved" ? "success" : "muted"
                              }
                              size="sm"
                              className="shrink-0"
                            >
                              {STATUS_LABELS[link.status]}
                            </Badge>
                            <span className="min-w-0 truncate text-xs text-gray-500">
                              {link.reviewed_by ?? EM_DASH}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Outside the <table> on purpose — the dialog portals out anyway, and a
          <div> is not valid inside a <tbody>. */}
      <LinkDetailPanel
        link={detail}
        now={now}
        onClose={() => setDetail(null)}
      />
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
