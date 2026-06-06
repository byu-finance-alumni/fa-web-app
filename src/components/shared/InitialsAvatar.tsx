/**
 * Initials avatar — a colored circle with 1–2 initials, deterministic color per
 * name. Used on table rows (alumni list, admin users, event attendees) and
 * record headers, matching the 07B CRM design.
 */

const COLORS = [
  "bg-navy-800",
  "bg-brand-blue-600",
  "bg-royal-700",
  "bg-brand-blue-500",
] as const;

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InitialsAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: keyof typeof SIZES;
}) {
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${SIZES[size]}`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
