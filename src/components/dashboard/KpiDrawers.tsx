"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { clientGet } from "@/lib/api-client";
import { MetricCard } from "@/components/shared/MetricCard";

interface ContactedRow {
  interaction_id: number;
  alumni_id: number;
  alumni_name: string;
  type: string | null;
  when: string | null;
  by: string | null;
}

interface FollowUpRow {
  task_id: number;
  alumni_id: number;
  alumni_name: string;
  title: string | null;
  due_date: string | null;
  assigned_to: string | null;
}

type DrawerKind = "contacted" | "followups";

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "No due date";

/**
 * The "Contacted this month" and "Upcoming follow-ups" KPI tiles, as buttons
 * that open a slide-out drawer (mirrors the events/geography drawers) listing
 * the actual items behind the count — the alumni contacted in the last 30
 * days, or the open tasks due soonest. Rows link to the alumni profile.
 */
export function KpiDrawers({
  contacted,
  followUps,
}: {
  contacted: React.ReactNode;
  followUps: React.ReactNode;
}) {
  const [open, setOpen] = useState<DrawerKind | null>(null);

  return (
    <>
      <MetricCard
        size="lg"
        label="Contacted this month"
        value={contacted}
        onClick={() => setOpen("contacted")}
        linkLabel="View alumni contacted this month"
      />
      <MetricCard
        size="lg"
        label="Upcoming follow-ups"
        value={followUps}
        onClick={() => setOpen("followups")}
        linkLabel="View upcoming follow-up tasks"
      />
      {open ? (
        <KpiDrawer kind={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------- drawer -- */

function KpiDrawer({
  kind,
  onClose,
}: {
  kind: DrawerKind;
  onClose: () => void;
}) {
  const [contacted, setContacted] = useState<ContactedRow[] | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const title =
    kind === "contacted" ? "Contacted this month" : "Upcoming follow-ups";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const load =
      kind === "contacted"
        ? clientGet<ContactedRow[]>("/dashboard/contacted-this-month").then(
            (rows) => !cancelled && setContacted(rows),
          )
        : clientGet<FollowUpRow[]>("/dashboard/follow-ups").then(
            (rows) => !cancelled && setFollowUps(rows),
          );
    load
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const rows = kind === "contacted" ? contacted : followUps;
  const empty =
    kind === "contacted"
      ? "No interactions in the last 30 days."
      : "No upcoming follow-up tasks.";

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-navy-900/30"
      />
      <aside
        role="dialog"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-gray-100 shadow-xl sm:w-[440px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-300 bg-white p-5">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="rounded-xl border border-gray-300 bg-white p-4">
            {loading ? (
              <p className="py-3 text-sm text-gray-400">Loading…</p>
            ) : error ? (
              <p className="py-3 text-sm text-gray-400">
                Couldn&apos;t load the list. Close and try again.
              </p>
            ) : !rows || rows.length === 0 ? (
              <p className="py-3 text-sm text-gray-400">{empty}</p>
            ) : kind === "contacted" ? (
              <ul className="divide-y divide-gray-100">
                {(rows as ContactedRow[]).map((r) => (
                  <li key={r.interaction_id} className="py-2">
                    <Link
                      href={`/alumni/${r.alumni_id}`}
                      className="block hover:opacity-80"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {r.alumni_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[r.type, fmtDateTime(r.when), r.by ? `by ${r.by}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(rows as FollowUpRow[]).map((r) => (
                  <li key={r.task_id} className="py-2">
                    <Link
                      href={`/alumni/${r.alumni_id}`}
                      className="block hover:opacity-80"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {r.title || "Untitled task"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[
                          r.alumni_name,
                          fmtDate(r.due_date),
                          r.assigned_to ? `assigned to ${r.assigned_to}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
