import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * KPI / metric tile: an uppercase label across the top and a single large,
 * centered value. Built on the design-system surface tokens (rounded-lg border,
 * subtle `shadow-card`) so it matches Card everywhere it's used — the Dashboard,
 * data-quality, and the alumni profile KPI strips.
 *
 * `icon`, `sub`, and `subTone` are accepted for backward compatibility but no
 * longer rendered (kept so existing call sites compile without edits).
 */
export function MetricCard({
  label,
  value,
  size = "sm",
  href,
  linkLabel,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  /** @deprecated no longer rendered. */
  icon?: LucideIcon;
  /** @deprecated no longer rendered. */
  sub?: string | null;
  /** @deprecated no longer rendered. */
  subTone?: "muted" | "success" | "warning" | "danger";
  /** "lg" = bigger value + padding, matching the 08 Dashboard tiles. */
  size?: "sm" | "lg";
  /** When set, the whole card becomes a link with a hover affordance. */
  href?: string;
  /** Accessible label for the link/button target (e.g. "View in alumni list"). */
  linkLabel?: string;
  /** When set (and no href), the card becomes a button — e.g. opens a drawer. */
  onClick?: () => void;
}) {
  const lg = size === "lg";
  const base = cn(
    "flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow-card",
    lg ? "p-5" : "p-4",
  );
  const inner = (
    <>
      {/* Title — uniform min-height so every card's title lines up across the
          top, whether it wraps to one line or two. */}
      <span className="block min-h-8 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center">
        <p
          className={cn(
            "font-semibold tracking-tight tabular-nums text-gray-900",
            lg ? "text-3xl" : "text-xl",
          )}
        >
          {value ?? "—"}
        </p>
      </div>
    </>
  );

  const interactive = cn(
    base,
    "cursor-pointer transition-colors hover:border-brand-blue-300 hover:bg-brand-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-1",
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={linkLabel ?? `${label}: view details`}
        className={interactive}
      >
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={linkLabel ?? `${label}: view details`}
        className={cn(interactive, "w-full")}
      >
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}
