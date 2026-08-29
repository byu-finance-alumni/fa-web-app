"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, clientPost } from "@/lib/api-client";
import { pendingReviewCount } from "@/components/needs-surveying/pending-review";
import type { PendingSubmissionsQueue } from "@/components/needs-surveying/use-pending-submissions";
import type { components } from "@/types/api.gen";

/**
 * What `POST /survey/responses/{id}/apply` returns (#646) — the generated type,
 * so the CI drift guard covers it.
 *
 * `clientPost` is still typed as possibly-undefined at the call site: the
 * endpoint was a bodyless 204 until this batch, and a backend that hasn't been
 * redeployed yet still returns one. `reject` returns no body at all.
 */
type ApplyResult = components["schemas"]["SurveyApplyResult"];

/**
 * Admin review queue for a graduation year: the alumni who submitted "confirm
 * your info" updates, each with a before/after diff. Apply writes the changes to
 * the record; reject discards them. Both hit the real backend and refresh the
 * list. This is the "admin confirms before anything is applied" step.
 *
 * The queue itself is NOT fetched here (Jake, 2026-08-07). The console owns it
 * via `usePendingSubmissions` and passes it in, because the Submissions tab now
 * shows the same count as a badge and the two must be the same state — see the
 * hook for why. This component renders that state and resolves rows out of it.
 */
export function PendingSubmissions({
  queue,
}: {
  queue: PendingSubmissionsQueue;
}) {
  const { toast } = useToast();
  const { items, removeItem } = queue;
  const count = pendingReviewCount(items);
  const [busyId, setBusyId] = useState<number | null>(null);

  const act = async (id: number, action: "apply" | "reject", name: string) => {
    setBusyId(id);
    try {
      const result = await clientPost<ApplyResult | undefined>(
        `/survey/responses/${id}/${action}`,
      );
      // A survey response can RENAME an alumnus, and a rename can land on top of
      // a live record (#627/#646). The backend applies it either way — two alumni
      // genuinely can share a name and a year — and reports the collision here.
      // This is the one thing the reviewer could not have known before clicking,
      // so it must not be swallowed. `reject` never returns warnings.
      //
      // Shown as `info`, not `error`: the apply SUCCEEDED. There is no warning
      // variant, and dressing a completed write in the red error surface would
      // read as "your change failed", which is the opposite of what happened.
      // Caveat: every toast auto-dismisses after 4.5s, so a reviewer who looks
      // away misses this. The durable record is the audit row.
      const warnings = result?.duplicate_warnings ?? [];
      if (action === "apply" && warnings.length > 0) {
        toast.info(
          `Applied ${name}'s updates, but the new name may duplicate an existing record: ${warnings
            .map((w) => w.message)
            .join(" ")}`,
        );
      } else {
        toast.success(
          action === "apply"
            ? `Applied ${name}'s updates.`
            : `Rejected ${name}'s submission.`,
        );
      }
      // Out of the shared queue, so the row and the tab's badge go together.
      removeItem(id);
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.message
          ? err.message
          : "Something went wrong.";
      toast.error(`Couldn't ${action}: ${msg}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mt-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Pending submissions
        </h2>
        {/* The same figure the tab's badge shows, through the same derivation —
            this header and that circle are two views of one list. */}
        <Badge variant="neutral">
          {count === null ? "…" : `${count.toLocaleString()} to review`}
        </Badge>
      </header>

      <div className="space-y-2 p-3">
        {items === null ? (
          <p className="px-2 py-3 text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-500">
            No submissions waiting for review in this graduation year.
          </p>
        ) : (
          items.map((r) => (
            <div
              key={r.survey_response_id}
              className="rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {r.name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatWhen(r.submitted_at)}
                </span>
              </div>

              {r.changes.length === 0 ? (
                <p className="mt-2 text-xs italic text-gray-400">
                  Confirmed, nothing changed.
                </p>
              ) : (
                <dl className="mt-2 space-y-1.5">
                  {r.changes.map((c) => (
                    <div key={c.field_key}>
                      <dt className="text-xs text-gray-500">{c.label}</dt>
                      <dd className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-400 line-through">
                          {c.before || "—"}
                        </span>
                        <span aria-hidden="true" className="text-gray-400">
                          →
                        </span>
                        <span className="font-medium text-gray-900">
                          {c.after || "—"}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {r.photo_preview_url ? (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">New profile photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.photo_preview_url}
                    alt={`New profile photo submitted by ${r.name}`}
                    className="mt-1 h-16 w-16 rounded-full object-cover"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="navy"
                  disabled={busyId === r.survey_response_id}
                  onClick={() =>
                    act(r.survey_response_id, "apply", r.name)
                  }
                >
                  <CheckCircle2 aria-hidden="true" />
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === r.survey_response_id}
                  onClick={() =>
                    act(r.survey_response_id, "reject", r.name)
                  }
                >
                  <XCircle aria-hidden="true" />
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
