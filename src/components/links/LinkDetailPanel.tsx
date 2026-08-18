"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EM_DASH,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
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
 * The whole record for one opportunity link, opened by clicking its row.
 *
 * WHY THIS EXISTS. The list is a spreadsheet now — one line per row, every field
 * in its own column, anything long cut off with an ellipsis. That trade is only
 * honest if the cut-off text is still reachable, so this panel is the other half
 * of the dense table rather than a nice extra: it is the ONLY place the full
 * `details` paragraph and the full URL are on screen. Anything the list
 * truncates has to appear here untruncated.
 *
 * TEXT ONLY (standing project rule). It deliberately does not pass `title` to
 * <DialogContent>, because that built-in header ships an icon close button; the
 * header below is hand-rolled around the exported `DialogTitle` so the only way
 * out that isn't Esc or the backdrop is a button that says the word "Close".
 *
 * THE URL RULE SURVIVES HERE TOO. `details` and `url` are free text an alum
 * typed into a public form. `url` becomes an `href` only after `linkTarget` has
 * scheme-checked it, exactly as in the list; when the guard rejects it the panel
 * still SHOWS the submitted string — a reviewer needs to read it in order to
 * reject it — but as text, with no anchor. Nothing here is rendered as HTML.
 */
export function LinkDetailPanel({
  link,
  now,
  onClose,
}: {
  /** The row to describe, or `null` when nothing is open. */
  link: OpportunityLink | null;
  /** Passed down so the age agrees with the row it was opened from. */
  now: Date;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={link !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* Radix owns Esc, the backdrop click and the focus trap; the footer
          button is the visible, worded third way out. */}
      {link ? <LinkDetailContent link={link} now={now} /> : null}
    </Dialog>
  );
}

function LinkDetailContent({ link, now }: { link: OpportunityLink; now: Date }) {
  const company = companyDisplay(link);
  const target = linkTarget(link.url);
  const stale = isStaleLink(link.submitted_at, now);
  const deadlinePassed = isDeadlinePassed(link.application_deadline, now);

  return (
    <DialogContent className="max-w-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <DialogTitle className="truncate text-base font-semibold text-gray-900">
            {company.label}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-gray-500">
            {ROLE_TYPE_LABELS[link.role_type]} · {locationDisplay(link)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {company.ownCompany ? (
            <Badge variant="tag" size="sm">
              Their own company
            </Badge>
          ) : null}
          {company.unresolved ? (
            <Badge variant="warning" size="sm">
              No employer on file
            </Badge>
          ) : null}
          {/* Same mapping as the list's Review cell, plus the pending
              case the list expresses as buttons instead of a badge. */}
          <Badge
            variant={
              link.status === "approved"
                ? "success"
                : link.status === "pending"
                  ? "neutral"
                  : "muted"
            }
            size="sm"
          >
            {STATUS_LABELS[link.status]}
          </Badge>
        </div>
      </div>

      <DialogBody>
        <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <Field label="Company">{company.label}</Field>
          <Field label="Role type">{ROLE_TYPE_LABELS[link.role_type]}</Field>
          <Field label="Location">{locationDisplay(link)}</Field>

          <dt className="text-gray-500">Link</dt>
          <dd className="min-w-0 break-all">
            {/* Public-submitted value: an anchor only once `linkTarget` has
                scheme-checked it, and the FULL url either way. */}
            {target.href ? (
              <a
                href={target.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-brand-blue-600 hover:underline"
              >
                {target.href}
              </a>
            ) : (
              <>
                <span className="text-gray-700">{link.url}</span>
                <span className="mt-1 block text-xs text-danger-600">
                  Not a usable http(s) address — shown as text, not a link.
                </span>
              </>
            )}
          </dd>

          <dt className="text-gray-500">Deadline</dt>
          <dd
            className={
              deadlinePassed ? "font-medium text-danger-600" : "text-gray-900"
            }
          >
            {link.application_deadline
              ? `${deadlinePassed ? "Closed " : "Apply by "}${formatLinkDate(
                  link.application_deadline,
                )}`
              : "No deadline given"}
          </dd>

          <Field label="Submitted by">
            {submittedByDisplay(link)} · {SOURCE_LABELS[link.source]}
          </Field>

          <dt className="text-gray-500">Submitted</dt>
          <dd className="text-gray-900">
            <span className="tabular-nums">
              {formatLinkDate(link.submitted_at)}
            </span>
            <span
              className={
                stale ? "font-medium text-warning-600" : "text-gray-500"
              }
            >
              {" "}
              · {linkAgeLabel(link.submitted_at, now)}
            </span>
          </dd>

          {link.status === "pending" ? null : (
            <Field label="Reviewed by">
              {link.reviewed_by ?? EM_DASH}
              {link.reviewed_at ? ` · ${formatLinkDate(link.reviewed_at)}` : ""}
            </Field>
          )}
        </dl>

        <div className="mt-4 border-t border-gray-200 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Details
          </p>
          {/* The list cuts this to one line. This is where it is readable. */}
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {link.details?.trim() ? link.details : "Nothing else was written."}
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Close
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-gray-900">{children}</dd>
    </>
  );
}
