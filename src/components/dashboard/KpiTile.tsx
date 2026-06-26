import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dashboard KPI tile — a richer take on the shared MetricCard for the dashboard's
 * launchpad, where the extra context earns its keep. A small leading Lucide icon
 * and the metric label sit on one row; the large value sits beneath. Built on the
 * same surface tokens as Card/MetricCard so it reads as the same family.
 *
 * Deliberately icon + label only — no trend deltas or percentages, because the
 * API exposes no historical/comparative data to derive them honestly.
 */
export function KpiTile({
  label,
  value,
  icon: Icon,
  href,
  linkLabel,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={linkLabel}
      className={cn(
        "flex h-full flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-card",
        "transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
      )}
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon className="h-4 w-4 shrink-0 text-brand-blue-600" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-gray-900">
        {value ?? "—"}
      </p>
    </Link>
  );
}
