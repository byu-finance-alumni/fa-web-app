import type { LucideIcon } from "lucide-react";

/**
 * KPI / metric tile in the 07B CRM style: an icon chip + uppercase label, a
 * 20px value, and an optional semantic-colored subtext (warning for missing
 * data, danger for duplicates, success for positive trends). Bordered radius-12
 * card. Shared by the Dashboard and the alumni profile KPI strip.
 */

const SUB_TONE = {
  muted: "text-gray-500",
  success: "text-success-600",
  warning: "text-warning-600",
  danger: "text-danger-600",
} as const;

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  subTone = "muted",
  size = "sm",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  subTone?: keyof typeof SUB_TONE;
  /** "lg" = bigger value + padding, matching the 08 Dashboard tiles. */
  size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div className={`rounded-xl border border-gray-300 bg-white ${lg ? "p-5" : "p-4"}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-blue-50 text-brand-blue-600">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <p
        className={`truncate font-semibold tabular-nums text-gray-900 ${lg ? "text-3xl" : "text-xl"}`}
      >
        {value ?? "—"}
      </p>
      {sub ? (
        <p className={`mt-1 text-xs ${SUB_TONE[subTone]}`}>{sub}</p>
      ) : null}
    </div>
  );
}
