"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, PackageCheck, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InitialsAvatar } from "@/components/shared/InitialsAvatar";
import type { Alumni } from "@/types/alumni";

function fullName(a: Alumni): string {
  const last = a.last_name ?? "";
  const first = a.preferred_first_name ?? a.first_name ?? "";
  return last && first ? `${last}, ${first}` : last || first || "—";
}

function avatarName(a: Alumni): string {
  return (
    [a.preferred_first_name ?? a.first_name, a.last_name]
      .filter(Boolean)
      .join(" ") || "?"
  );
}

/**
 * "Needs Surveying" survey-campaign console (frontend-only, #160).
 *
 * This is NOT the alumni roster — it's a campaign launcher. It presents the
 * biennial re-survey DUE set as a worklist and lets staff stage a send batch:
 *
 *   GRAB  → assemble the alumni currently due (this filtered page) into a
 *           reviewable client-side BATCH (the recipient list a campaign would
 *           target). No backend campaign endpoint exists yet, so the batch is
 *           staged in component state only.
 *   SEND  → a deliberately-disabled PLACEHOLDER for the future "verify your
 *           info" email flow (see docs/spikes/verify-info-email-spike.md). It
 *           never calls an API.
 *
 * `dueCount` is the server total for the due set (across all pages); `items` is
 * the current filtered page. Grabbing stages the current page's recipients so
 * staff can see exactly who would be contacted before any (future) send.
 */
export function SurveyCampaignConsole({
  items,
  dueCount,
  pageCount,
}: {
  items: Alumni[];
  /** Total alumni in the due set (server total, all pages). */
  dueCount: number;
  /** How many are shown on the current filtered page. */
  pageCount: number;
}) {
  const router = useRouter();
  // The staged send batch — the recipient list a campaign would target.
  // null = not yet grabbed. Frontend-only staging; clears on reload/navigation.
  const [batch, setBatch] = useState<Alumni[] | null>(null);

  const grab = () => setBatch(items);
  const clearBatch = () => setBatch(null);

  // How many emails the (future) send would target — the staged batch if one is
  // grabbed, otherwise this page's recipients. Real counts only.
  const sendCount = batch?.length ?? pageCount;
  // Campaign progress: how much of the total due set is staged in this batch.
  // Real numbers only ("this batch vs total due") — no completion data exists.
  const batchPct = dueCount > 0 ? ((batch?.length ?? 0) / dueCount) * 100 : 0;

  return (
    <>
      {/* Campaign header card — distinct navy console identity, not a roster
          toolbar. Explains the biennial cadence, shows the due count, and hosts
          the two campaign actions (Grab = stage batch, Send = placeholder). */}
      <Card className="overflow-hidden border-navy-800 bg-navy-800 text-white">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue-300">
              Re-survey campaign
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              <span className="tabular-nums">{dueCount}</span>{" "}
              {dueCount === 1 ? "alum is" : "alumni are"} due for re-survey
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Alumni get re-surveyed every two years — anyone never surveyed, or
              whose last completed survey is more than two years old. Grab the
              due list into a send batch, then send the verify-your-info request.
            </p>

            {/* Campaign progress — how much of the total due set is staged in
                the current send batch. Uses real counts only (batch vs total
                due); there's no sent/completed signal to show yet. */}
            <div className="mt-4 max-w-xl">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Staged for this batch</span>
                <span className="tabular-nums">
                  {(batch?.length ?? 0).toLocaleString()} of{" "}
                  {dueCount.toLocaleString()} due
                </span>
              </div>
              <Progress
                value={batchPct}
                className="mt-1.5 bg-white/20"
                barClassName="bg-brand-blue-300"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={grab}
              disabled={pageCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-4 text-sm font-semibold text-navy-800 transition-colors hover:bg-brand-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-navy-800 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-navy-800/50"
            >
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              {batch ? "Re-grab surveys" : "Grab surveys"}
            </button>
            {/* Placeholder — the verify-your-info email flow is not built yet.
                Disabled and explicitly labeled; never calls an API. The count
                reflects the real recipients a send would target (staged batch,
                else this page). */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={`Coming soon — will email the verify-your-info link to ${sendCount.toLocaleString()} ${
                sendCount === 1 ? "alum" : "alumni"
              }`}
              className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border border-white/30 px-4 text-sm font-semibold text-white/60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send {sendCount.toLocaleString()}{" "}
              {sendCount === 1 ? "survey" : "surveys"}
            </button>
          </div>
        </div>
      </Card>

      {/* Staged batch panel — appears after Grab. Shows the assembled recipient
          list ("N alumni ready to survey") so staff can review exactly who a
          campaign would target before the (future) send. */}
      {batch && (
        <Card className="mt-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                <span className="tabular-nums">{batch.length}</span>{" "}
                {batch.length === 1 ? "alum" : "alumni"} ready to survey
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Staged send batch — recipients of the next verify-your-info
                campaign.
                {dueCount > batch.length ? (
                  <>
                    {" "}
                    Showing this page&apos;s{" "}
                    <span className="tabular-nums">{batch.length}</span> of{" "}
                    <span className="tabular-nums">{dueCount}</span> due — narrow
                    with filters, then re-grab to adjust who&apos;s included.
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Send placeholder, mirrored next to the batch for emphasis —
                  still disabled, still no API call. */}
              <Badge variant="warning">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Sending not wired up yet
              </Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clearBatch}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear batch
              </Button>
            </div>
          </header>

          {/* Recipient chips — a compact, scannable summary of who's in the
              batch. Each links to the profile so staff can spot-check. */}
          <div className="flex flex-wrap gap-2 p-5">
            {batch.map((a) => (
              <Link
                key={a.alumni_id}
                href={`/alumni/${a.alumni_id}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm text-gray-900 transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1"
              >
                <InitialsAvatar name={avatarName(a)} size="sm" />
                <span className="truncate">{fullName(a)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Worklist — scoped re-survey columns, intentionally simpler than the
          full roster (no industry/LinkedIn/quick-filter clutter). The whole row
          navigates to the profile. */}
      <Card className="mt-4 hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5">Alum</th>
              <th className="w-28 px-4 py-2.5">Grad year</th>
              <th className="px-4 py-2.5">Current employer</th>
              <th className="w-40 px-4 py-2.5">Survey status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const inBatch = batch?.some((b) => b.alumni_id === a.alumni_id);
              return (
                <tr
                  key={a.alumni_id}
                  onClick={() => router.push(`/alumni/${a.alumni_id}`)}
                  className="group cursor-pointer border-b border-gray-200 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={avatarName(a)} size="sm" />
                      <Link
                        href={`/alumni/${a.alumni_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-gray-900 group-hover:text-brand-blue-600"
                      >
                        {fullName(a)}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-700">
                    {a.graduation_year ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {a.current_employer ?? (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {inBatch ? (
                      <Badge variant="tag">
                        <PackageCheck
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        In batch
                      </Badge>
                    ) : (
                      <Badge variant="warning">Due for re-survey</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Mobile: stacked worklist cards (dense table collapses, no h-scroll). */}
      <div className="mt-4 space-y-2 md:hidden">
        {items.map((a) => {
          const inBatch = batch?.some((b) => b.alumni_id === a.alumni_id);
          return (
            <Link
              key={a.alumni_id}
              href={`/alumni/${a.alumni_id}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-card"
            >
              <InitialsAvatar name={avatarName(a)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">
                  {fullName(a)}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {[
                    a.graduation_year ? `Class of ${a.graduation_year}` : null,
                    a.current_employer,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              {inBatch ? (
                <PackageCheck
                  className="h-4 w-4 shrink-0 text-brand-blue-600"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
