"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { clientGet } from "@/lib/api-client";
import {
  bouncedDetail,
  bouncedFixedNote,
  bouncedHeadline,
  bouncedRequestPath,
  bouncedTruncatedNote,
  type SurveyBouncedPage,
} from "@/components/needs-surveying/bounced";

/**
 * Bounced (#858) — alumni whose survey email for this year was permanently
 * refused by the receiving server, from Resend's bounce webhook.
 *
 * The companion to "Cannot be reached" just above it: that block lists people
 * with no usable address on file; this one lists people whose address looked
 * fine and was rejected. Same shape on purpose — a count, a "Show list" toggle,
 * and each name linking to the profile so the address can be fixed there.
 *
 * Fetched when the year changes (not lazily) because the count IS the headline
 * and the list is small. Renders nothing while loading, on error, or when there
 * are none — exactly like the unreachable block, which hides at zero.
 *
 * Lists only; it changes nothing about anyone. Text-only: no icons in new UI.
 */
export function SurveyBouncedList({ year }: { year: number | null }) {
  const [page, setPage] = useState<SurveyBouncedPage | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Clear first so a stale year's names can never be read as this year's.
    setPage(null);
    setOpen(false);
    if (year === null) return;
    let cancelled = false;
    clientGet<SurveyBouncedPage>(bouncedRequestPath(year))
      .then((result) => {
        if (!cancelled) setPage(result ?? null);
      })
      .catch(() => {
        if (!cancelled) setPage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (!page || page.total === 0) return null;
  const items = page.items;
  const truncated = bouncedTruncatedNote(page);

  return (
    <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy-800">
          Bounced:{" "}
          <span className="tabular-nums">{bouncedHeadline(page.total)}</span>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide list" : "Show list"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        The receiving mail server permanently refused these addresses. Open the
        profile to correct the email; nothing is changed automatically.
      </p>
      {open && truncated ? (
        <p className="mt-3 text-xs text-gray-500">{truncated}</p>
      ) : null}
      {open ? (
        <ul className="mt-3 divide-y divide-amber-200 border-t border-amber-200">
          {items.map((a) => {
            const fixed = bouncedFixedNote(a);
            return (
              <li
                key={a.alumni_id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <a
                  href={`/alumni/${a.alumni_id}`}
                  className="text-sm font-medium text-navy-800 underline underline-offset-2"
                >
                  {a.name}
                </a>
                <span className="text-xs text-gray-600">
                  {bouncedDetail(a)}
                  {fixed ? (
                    <span className="ml-1 text-gray-400">({fixed})</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
