import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * KPI / metric tile: an uppercase label across the top and a single large,
 * centered value. Built on the design-system surface tokens (rounded-lg border,
 * subtle `shadow-card`) so it matches Card everywhere it's used — the Dashboard,
 * data-quality, and the alumni profile KPI strips.
 *
 * `sub` renders a single muted line UNDER the value — the context a bare number
 * can't carry on its own ("Across 18 industries", "6% of all records"). It was
 * dormant for a while (accepted but not rendered); the 2026-08-19 dashboard
 * redesign brought it back, and no other call site passes it, so nothing else
 * changes shape.
 *
 * `subTone` recolours that line off the semantic tokens. Same story as `sub`:
 * only the dashboard passes it today, so every other tile keeps the muted grey
 * default and nothing else changes shape.
 *
 * `icon` is still accepted for backward compatibility but is NOT rendered —
 * this product's tiles are text-only (no icons anywhere).
 */
export function MetricCard({
  label,
  value,
  sub,
  subTone = "muted",
  size = "sm",
  raised = false,
  href,
  linkLabel,
  onClick,
  title,
}: {
  label: string;
  value: React.ReactNode;
  /** Native hover tooltip on the tile (e.g. who last updated the record). */
  title?: string;
  /** @deprecated no longer rendered — tiles in this app are text-only. */
  icon?: LucideIcon;
  /** Muted context line under the value (e.g. "Across 18 industries"). Omit or
   *  pass null when the figure it would describe isn't available — never a
   *  guessed one. */
  sub?: string | null;
  /** Semantic colour for `sub`. Defaults to the muted grey every existing tile
   *  already renders, so this is opt-in exactly like `raised`. */
  subTone?: "muted" | "success" | "warning" | "danger";
  /** "lg" = bigger value + padding, matching the 08 Dashboard tiles. */
  size?: "sm" | "lg";
  /** Dashboard-only "raised" treatment: left-aligned text and a deeper shadow so
   *  the tiles read as floating above the page, per the 2026-08-19 mockup.
   *  OPT-IN because MetricCard is shared by the alumni profile, data-quality,
   *  Pay It Forward, the KPI drawers and the donations panel — every one of
   *  those stays centered and on the standard `shadow-card`. */
  raised?: boolean;
  /** When set, the whole card becomes a link with a hover affordance. */
  href?: string;
  /** Accessible label for the link/button target (e.g. "View in alumni list"). */
  linkLabel?: string;
  /** When set (and no href), the card becomes a button — e.g. opens a drawer. */
  onClick?: () => void;
}) {
  const lg = size === "lg";
  const base = cn(
    "flex h-full flex-col rounded-lg border border-gray-200 bg-white",
    // `shadow-card` is the design system's single subtle card elevation. The
    // raised variant steps up one level (the popover tier) rather than inventing
    // a new shadow, so the hierarchy in UX-UI.md still holds.
    raised ? "shadow-md" : "shadow-card",
    // The raised tiles carry the mockup's generous 24px inset; every other call
    // site keeps the dense CRM padding it has today.
    raised ? "p-6" : lg ? "p-5" : "p-4",
  );
  // Semantic sub-line tones, all straight off the UX-UI.md status tokens.
  const subToneClass = {
    muted: "text-gray-500",
    success: "text-success-600",
    warning: "text-warning-600",
    danger: "text-danger-600",
  }[subTone];
  const inner = (
    <>
      {/* Title — uniform min-height so every card's title lines up across the
          top, whether it wraps to one line or two. */}
      <span
        className={cn(
          "block min-h-8 text-xs font-semibold uppercase tracking-wide text-gray-500",
          raised ? "text-left" : "text-center",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "flex flex-1 flex-col justify-center",
          raised ? "items-start" : "items-center",
        )}
      >
        <p
          className={cn(
            "tracking-tight tabular-nums text-gray-900",
            raised ? "text-left font-bold" : "text-center font-semibold",
            // Raised tiles run one step up the scale (36px) — the dashboard is
            // the only screen where the number is the headline.
            lg ? (raised ? "text-4xl" : "text-3xl") : "text-xl",
          )}
        >
          {value ?? "—"}
        </p>
        {sub ? (
          <p
            className={cn(
              "mt-1 text-xs",
              subToneClass,
              raised ? "text-left" : "text-center",
            )}
          >
            {sub}
          </p>
        ) : null}
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
        title={title}
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
        title={title}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={base} title={title}>
      {inner}
    </div>
  );
}
